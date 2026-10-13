import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisResult } from '../services/analytics/types';
import { fetchAvailableHistory } from '../services/analytics/CrimeHistoryService';
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
  calculateStateBenchmark
} from '../services/analytics/MetricsEngine';
import {
  loadIbgeCities,
  getIbgeCityForSspKey,
  getCityDisplayName,
  resolveSspKey,
  NON_CITY_KEYS
} from '../services/analytics/CityDirectory';

export const useCrimeAnalysis = (normalizedCity: string | null) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentCityRef = useRef<string | null>(null);

  const calculateAnalysis = useCallback(async (forceRefresh: boolean = false) => {
    currentCityRef.current = normalizedCity;
    const cityForThisRequest = normalizedCity;

    if (!cityForThisRequest) {
      setAnalysis(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const history = await fetchAvailableHistory(forceRefresh);
      
      if (currentCityRef.current !== cityForThisRequest) return;

      // Resolve variações de nome ("S. PAULO", "Santo André"...) para a chave exata da SSP
      const latestAll = history.length > 0 ? history[history.length - 1].data : {};
      const sspKeys = Object.keys(latestAll).filter(k => !NON_CITY_KEYS.includes(k));
      const cityKey = resolveSspKey(cityForThisRequest, sspKeys) ?? cityForThisRequest;
      
      const cityHistory = history
        .map(h => ({
          year: h.year,
          month: h.month,
          data: h.data[cityKey]
        }))
        .filter(h => h.data !== undefined); // Only periods where city has data

      if (cityHistory.length === 0) {
        if (currentCityRef.current !== cityForThisRequest) return;
        setAnalysis(null);
        setError('not_found');
        setLoading(false);
        return;
      }

      // Sort chronological
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
      const periodAll = history.find(h => h.year === currentPeriod.year && h.month === currentPeriod.month)?.data ?? latestAll;
      const benchmark = calculateStateBenchmark(
        periodAll,
        cityKey,
        (key) => getIbgeCityForSspKey(key, ibge)?.population
      );

      // 4. Trends
      const monthlyTotals = cityHistory.map(h => ({
        year: h.year,
        month: h.month,
        total: calculateTotalOccurrences(h.data)
      }));

      const trend = analyzeTrend(monthlyTotals);

      // 4. Data Quality
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
        dataQuality
      };

      // 5. Generate Insights and Recommendations
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
  }, [normalizedCity]);

  useEffect(() => {
    calculateAnalysis();
  }, [calculateAnalysis]);

  return {
    analysis,
    loading,
    error,
    refresh: () => calculateAnalysis(true)
  };
};
