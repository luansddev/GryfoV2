import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisResult } from '../services/analytics/types';
import { apiConfig } from '../config/api';
import * as CrimeHistoryService from '../services/analytics/CrimeHistoryService';
import { fetchApiCrimeAnalysis } from '../services/analytics/apiAnalysisAdapter';
import { ApiError } from '../services/api/httpClient';
import { getPopulationForCity } from '../services/analytics/PopulationService';
import { analyzeTrend } from '../services/analytics/TrendAnalyzer';
import { generateInsights } from '../services/analytics/InsightEngine';
import { generateRecommendations } from '../services/analytics/RecommendationEngine';
import {
  calculateTotalOccurrences,
  calculateCategoryTotals,
  calculateCategoryShares,
  calculateDominantCategory,
  calculateDominantCrime,
  calculateRatePer100k,
  calculateTopCrimes,
  calculateStateBenchmark,
  getEntryOccurrenceCount,
} from '../services/analytics/MetricsEngine';
import {
  loadIbgeCities,
  getIbgeCityForSspKey,
  getCityDisplayName,
  resolveSspKey,
  NON_CITY_KEYS,
} from '../services/analytics/CityDirectory';

export interface CrimeAnalysisOptions {
  /**
   * Período cronológico opcional a ser analisado.
   * Se omitido (ou nulo), mantém o comportamento padrão inicial (fevereiro de 2026 via métricas locais).
   */
  period?: { year: number; month: number } | null;
}

export const useCrimeAnalysis = (
  normalizedCity: string | null,
  options?: CrimeAnalysisOptions
) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCityRef = useRef<string | null>(null);
  const currentPeriodRef = useRef<{ year: number; month: number } | null | undefined>(
    options?.period
  );

  useEffect(() => {
    currentPeriodRef.current = options?.period;
  }, [options?.period?.year, options?.period?.month]);

  const calculateAnalysis = useCallback(
    async (forceRefresh: boolean = false) => {
      currentCityRef.current = normalizedCity;
      const cityForThisRequest = normalizedCity;
      const periodForThisRequest = options?.period;

      if (!cityForThisRequest) {
        setAnalysis(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. ESTRATÉGIA API ANALÍTICA: Ativada exclusivamente quando:
        //    - Um período explícito foi solicitado;
        //    - A fonte configurada for 'api';
        //    - O período for catalogado como ativo oficial (type === 'active' e !isCompatibilityFixture).
        if (periodForThisRequest && apiConfig.source === 'api') {
          const availablePeriods = await CrimeHistoryService.fetchAvailablePeriods(forceRefresh);
          if (currentCityRef.current !== cityForThisRequest) return;

          const activePeriod = availablePeriods.find(
            (p) =>
              p.year === periodForThisRequest.year &&
              p.month === periodForThisRequest.month &&
              p.type === 'active' &&
              !p.isCompatibilityFixture
          );

          if (activePeriod) {
            try {
              const apiResult = await fetchApiCrimeAnalysis(
                cityForThisRequest,
                periodForThisRequest.year,
                periodForThisRequest.month,
                forceRefresh
              );

              if (currentCityRef.current !== cityForThisRequest) return;
              setAnalysis(apiResult);
              return;
            } catch (apiErr: unknown) {
              if (currentCityRef.current !== cityForThisRequest) return;

              if (apiErr instanceof ApiError && apiErr.status === 404) {
                setAnalysis(null);
                setError('not_found');
                return;
              }

              console.error('Error fetching API crime analysis:', apiErr);
              setAnalysis(null);
              setError('error');
              return;
            }
          }
        }

        // 2. ESTRATÉGIA MÉTRICAS LOCAIS: Utilizada quando:
        //    - Nenhum período explícito foi solicitado (mantém fevereiro/2026);
        //    - O período solicitado for de compatibilidade/fixture (ex: fevereiro de 2026);
        //    - A fonte configurada for 'firebase';
        //    - Fallback contingencial do CrimeHistoryService para dados locais.
        const history = await CrimeHistoryService.fetchAvailableHistory(forceRefresh);

        if (currentCityRef.current !== cityForThisRequest) return;

        // Resolve variações de nome ("S. PAULO", "Santo André"...) para a chave exata da SSP
        const latestAll = history.length > 0 ? history[history.length - 1].data : {};
        const sspKeys = Object.keys(latestAll).filter((k) => !NON_CITY_KEYS.includes(k));
        const cityKey = resolveSspKey(cityForThisRequest, sspKeys) ?? cityForThisRequest;

        // Se um período específico de compatibilidade foi solicitado, filtra para esse período
        let cityHistory = history
          .filter((h) => {
            if (!periodForThisRequest) return true;
            return h.year === periodForThisRequest.year && h.month === periodForThisRequest.month;
          })
          .map((h) => ({
            year: h.year,
            month: h.month,
            data: h.data[cityKey],
          }))
          .filter((h) => h.data !== undefined);

        if (cityHistory.length === 0) {
          if (currentCityRef.current !== cityForThisRequest) return;
          setAnalysis(null);
          setError('not_found');
          setLoading(false);
          return;
        }

        // Ordenação cronológica
        cityHistory.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });

        const currentPeriod = cityHistory[cityHistory.length - 1];
        const currentData = currentPeriod.data;

        // 1. Calculate Metrics
        const totalOccurrences = calculateTotalOccurrences(currentData);
        const categoryTotals = calculateCategoryTotals(currentData);
        const categories = calculateCategoryShares(categoryTotals, totalOccurrences);
        const dominantCategory = calculateDominantCategory(categories);
        const dominantCrime = calculateDominantCrime(currentData, totalOccurrences);
        const topCrimes = calculateTopCrimes(currentData, totalOccurrences, 5);
        const otherTotal = Math.max(
          0,
          totalOccurrences - categoryTotals.life - categoryTotals.physical - categoryTotals.patrimony
        );

        // 2. Population & Rate
        const population = await getPopulationForCity(cityKey);
        const ratePer100k = calculateRatePer100k(totalOccurrences, population);
        const ibge = await loadIbgeCities();
        const displayName = getCityDisplayName(cityKey, ibge);

        // 3. Comparação com o estado (mesmo período)
        const periodAll =
          history.find(
            (h) => h.year === currentPeriod.year && h.month === currentPeriod.month
          )?.data ?? latestAll;
        const benchmark = calculateStateBenchmark(
          periodAll,
          cityKey,
          (key) => getIbgeCityForSspKey(key, ibge)?.population
        );

        // 4. Trends
        const monthlyTotals = cityHistory.map((h) => ({
          year: h.year,
          month: h.month,
          total: calculateTotalOccurrences(h.data),
        }));

        const trend = analyzeTrend(monthlyTotals);

        // Raw crimes e histórico por crime
        const rawCrimes: Record<string, number> = {};
        if (currentData) {
          Object.keys(currentData).forEach((key) => {
            rawCrimes[key] = getEntryOccurrenceCount(currentData[key]);
          });
        }

        const monthlyCrimes = cityHistory.map((h) => {
          const crimes: Record<string, number> = {};
          if (h.data) {
            Object.keys(h.data).forEach((key) => {
              crimes[key] = getEntryOccurrenceCount(h.data[key]);
            });
          }
          return {
            year: h.year,
            month: h.month,
            crimes,
            total: calculateTotalOccurrences(h.data),
          };
        });

        const stateCrimeTotals: Record<string, number> = {};
        if (periodAll) {
          Object.keys(periodAll).forEach((cKey) => {
            const cData = periodAll[cKey];
            if (cData) {
              Object.keys(cData).forEach((crimeKey) => {
                stateCrimeTotals[crimeKey] =
                  (stateCrimeTotals[crimeKey] || 0) + getEntryOccurrenceCount(cData[crimeKey]);
              });
            }
          });
        }

        // 5. Data Quality
        const firstMonth = cityHistory[0].month.toString().padStart(2, '0');
        const lastMonth = currentPeriod.month.toString().padStart(2, '0');

        const dataQuality = {
          availableMonths: cityHistory.length,
          firstPeriod: `${firstMonth}/${cityHistory[0].year}`,
          lastPeriod: `${lastMonth}/${currentPeriod.year}`,
          hasPopulation: population !== undefined,
          hasEnoughHistoryForTrend: cityHistory.length >= 2,
          hasEnoughHistoryForYoY: cityHistory.length >= 13,
        };

        const partialAnalysis: Partial<AnalysisResult> = {
          city: cityKey,
          displayName,
          population,
          totalOccurrences,
          ratePer100k,
          categories,
          otherTotal,
          dominantCategory,
          dominantCrime,
          topCrimes,
          benchmark,
          trend,
          dataQuality,
          rawCrimes,
          monthlyCrimes,
          stateCrimeTotals,
        };

        // 6. Generate Insights and Recommendations
        const insights = generateInsights(partialAnalysis);
        const recommendations = generateRecommendations(partialAnalysis);

        const result: AnalysisResult = {
          ...partialAnalysis,
          city: cityKey,
          totalOccurrences,
          categories,
          insights,
          recommendations,
          dataQuality,
        };

        if (currentCityRef.current !== cityForThisRequest) return;
        setAnalysis(result);
      } catch (err) {
        if (currentCityRef.current !== cityForThisRequest) return;
        console.error('Error analyzing crime data:', err);
        setError('error');
      } finally {
        if (currentCityRef.current === cityForThisRequest) {
          setLoading(false);
        }
      }
    },
    [normalizedCity, options?.period?.year, options?.period?.month]
  );

  useEffect(() => {
    calculateAnalysis();
  }, [calculateAnalysis]);

  return {
    analysis,
    loading,
    error,
    refresh: () => calculateAnalysis(true),
  };
};
