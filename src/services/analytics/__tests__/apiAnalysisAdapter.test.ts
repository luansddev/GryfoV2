/**
 * src/services/analytics/__tests__/apiAnalysisAdapter.test.ts
 * Testes unitários para o adaptador analítico da Gardio API (Summary, Benchmark, Cache, Mapeamento).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ApiError } from '../../api/httpClient';
import {
  fetchSummaryWithDeduplication,
  fetchBenchmarkWithDeduplication,
  mapApiAnalyticsToAnalysisResult,
  fetchApiCrimeAnalysis,
  clearApiAnalysisCache,
  PeriodMismatchError,
} from '../apiAnalysisAdapter';
import * as gardioApi from '../../api/gardioApi';
import { MunicipalitySummary, StatewideBenchmark } from '../../api/types';

jest.mock('../../api/gardioApi');

describe('src/services/analytics/apiAnalysisAdapter.ts', () => {
  const mockSummaryData: MunicipalitySummary = {
    municipality_key: 'SAO PAULO',
    municipality_name: 'São Paulo',
    year: 2026,
    month: 7,
    period: '2026-07',
    population_2022: 11451245,
    total_occurrences: 31750,
    rate_per_100k: 277.26,
    category_totals: {
      vida: 412,
      integridade_fisica: 2890,
      patrimonio: 25110,
      outros: 3338,
    },
    category_shares: {
      vida: 1.3,
      integridade_fisica: 9.1,
      patrimonio: 79.08,
      outros: 10.51,
    },
    top_crimes: [
      {
        nature_code: 'furto_outros',
        nature_name: 'Furto - Outros',
        category: 'patrimonio',
        quantity: 14200,
        percentage: 44.72,
      },
      {
        nature_code: 'roubo_outros',
        nature_name: 'Roubo - Outros',
        category: 'patrimonio',
        quantity: 8500,
        percentage: 26.77,
      },
    ],
  };

  const mockBenchmarkData: StatewideBenchmark = {
    state: 'SP',
    year: 2026,
    month: 7,
    period: '2026-07',
    total_occurrences: 90319,
    state_population: 44411238,
    rate_per_100k: null, // Cobertura parcial
    covered_municipalities: 626,
    covered_population: 44358687,
    covered_rate_per_100k: 203.38,
    category_totals: {
      vida: 1150,
      integridade_fisica: 10240,
      patrimonio: 68900,
      outros: 10029,
    },
    category_shares: {
      vida: 1.27,
      integridade_fisica: 11.34,
      patrimonio: 76.29,
      outros: 11.1,
    },
  };

  beforeEach(() => {
    clearApiAnalysisCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearApiAnalysisCache();
  });

  describe('mapApiAnalyticsToAnalysisResult', () => {
    it('mapeia fielmente os campos de Summary e Benchmark sem recalcular métricas', () => {
      const result = mapApiAnalyticsToAnalysisResult(mockSummaryData, mockBenchmarkData);

      expect(result.city).toBe('SAO PAULO');
      expect(result.displayName).toBe('São Paulo');
      expect(result.totalOccurrences).toBe(31750);
      expect(result.ratePer100k).toBe(277.26);
      expect(result.population).toBe(11451245);
      expect(result.otherTotal).toBe(3338);

      // Categorias ordenadas por percentual decrescente
      expect(result.categories).toEqual([
        { id: 'patrimony', total: 25110, percentage: 79.08 },
        { id: 'physical', total: 2890, percentage: 9.1 },
        { id: 'life', total: 412, percentage: 1.3 },
      ]);
      expect(result.dominantCategory).toBe('patrimony');

      // Top crimes e dominante
      expect(result.topCrimes).toHaveLength(2);
      expect(result.topCrimes![0].name).toBe('Furto - Outros');
      expect(result.dominantCrime).toEqual({
        name: 'Furto - Outros',
        total: 14200,
        percentage: 44.72,
      });

      // Benchmark com cobertura parcial explícita
      expect(result.benchmark).toBeDefined();
      expect(result.benchmark!.stateTotal).toBe(90319);
      expect(result.benchmark!.isPartialCoverage).toBe(true);
      expect(result.benchmark!.coveredRatePer100k).toBe(203.38);
      expect(result.benchmark!.coveredMunicipalities).toBe(626);
      expect(result.benchmark!.coveredPopulation).toBe(44358687);
      expect(result.benchmark!.stateRatePer100k).toBeUndefined(); // Não expõe como taxa estadual integral
    });

    it('mantém distinção semântica em cobertura parcial: stateRatePer100k é undefined e coveredRatePer100k preserva a taxa dos municípios cobertos', () => {
      const partialBenchmark: StatewideBenchmark = {
        state: 'SP',
        year: 2026,
        month: 7,
        period: '2026-07',
        total_occurrences: 90319,
        state_population: 44411238,
        rate_per_100k: null,
        covered_rate_per_100k: 203.38,
        covered_municipalities: 626,
        covered_population: 44358687,
        category_totals: { vida: 1150, integridade_fisica: 10240, patrimonio: 68900, outros: 10029 },
        category_shares: { vida: 1.27, integridade_fisica: 11.34, patrimonio: 76.29, outros: 11.1 },
      };

      const result = mapApiAnalyticsToAnalysisResult(mockSummaryData, partialBenchmark);

      expect(result.benchmark!.isPartialCoverage).toBe(true);
      expect(result.benchmark!.coveredRatePer100k).toBe(203.38);
      expect(result.benchmark!.coveredMunicipalities).toBe(626);
      expect(result.benchmark!.coveredPopulation).toBe(44358687);
      expect(result.benchmark!.stateRatePer100k).toBeUndefined();

      // Motores analíticos (insights e recomendações) não produzem comparações com a média do estado
      expect(result.insights.some((i) => i.description.includes('média de SP') || i.title.includes('média'))).toBe(false);
      expect(result.recommendations.some((r) => r.description.includes('média'))).toBe(false);
    });

    it('preserva campos nullable como undefined em AnalysisResult (não converte para zero)', () => {
      const summaryWithoutPop: MunicipalitySummary = {
        ...mockSummaryData,
        population_2022: null,
        rate_per_100k: null,
      };

      const result = mapApiAnalyticsToAnalysisResult(summaryWithoutPop, mockBenchmarkData);

      expect(result.population).toBeUndefined();
      expect(result.ratePer100k).toBeUndefined();
      expect(result.dataQuality.hasPopulation).toBe(false);
    });

    it('mantém isPartialCoverage = false quando a taxa geral estadual for não-nula (cobertura 100%)', () => {
      const benchmarkFullCoverage: StatewideBenchmark = {
        ...mockBenchmarkData,
        rate_per_100k: 203.38,
      };

      const result = mapApiAnalyticsToAnalysisResult(mockSummaryData, benchmarkFullCoverage);

      expect(result.benchmark!.isPartialCoverage).toBe(false);
      expect(result.benchmark!.stateRatePer100k).toBe(203.38);
    });
  });

  describe('fetchSummaryWithDeduplication e fetchBenchmarkWithDeduplication', () => {
    it('evita chamadas concorrentes duplicadas reutilizando a Promise em voo', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockSummaryData }), 20);
          })
      );

      const [p1, p2, p3] = await Promise.all([
        fetchSummaryWithDeduplication('SAO PAULO', 2026, 7),
        fetchSummaryWithDeduplication('SAO PAULO', 2026, 7),
        fetchSummaryWithDeduplication('SAO PAULO', 2026, 7),
      ]);

      expect(p1).toEqual(mockSummaryData);
      expect(p2).toEqual(mockSummaryData);
      expect(p3).toEqual(mockSummaryData);
      expect(gardioApi.getCrimeStatisticsSummary).toHaveBeenCalledTimes(1);
    });

    it('reutiliza dados do cache para a mesma chave de município e período', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockResolvedValue({
        data: mockSummaryData,
      });

      const res1 = await fetchSummaryWithDeduplication('SAO PAULO', 2026, 7);
      expect(res1).toEqual(mockSummaryData);
      expect(gardioApi.getCrimeStatisticsSummary).toHaveBeenCalledTimes(1);

      // Chamada idêntica deve vir do cache
      const res2 = await fetchSummaryWithDeduplication('SAO PAULO', 2026, 7);
      expect(res2).toEqual(mockSummaryData);
      expect(gardioApi.getCrimeStatisticsSummary).toHaveBeenCalledTimes(1);

      // Chamada com forceRefresh = true deve re-executar a requisição
      const res3 = await fetchSummaryWithDeduplication('SAO PAULO', 2026, 7, true);
      expect(res3).toEqual(mockSummaryData);
      expect(gardioApi.getCrimeStatisticsSummary).toHaveBeenCalledTimes(2);
    });

    it('não reutiliza cache entre municípios ou períodos diferentes', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockResolvedValue({
        data: mockSummaryData,
      });

      await fetchSummaryWithDeduplication('SAO PAULO', 2026, 7);
      await fetchSummaryWithDeduplication('CAMPINAS', 2026, 7);

      expect(gardioApi.getCrimeStatisticsSummary).toHaveBeenCalledTimes(2);
    });

    it('deduplica requisições concorrentes de benchmark', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockBenchmarkData }), 20);
          })
      );

      const [b1, b2] = await Promise.all([
        fetchBenchmarkWithDeduplication(2026, 7),
        fetchBenchmarkWithDeduplication(2026, 7),
      ]);

      expect(b1).toEqual(mockBenchmarkData);
      expect(b2).toEqual(mockBenchmarkData);
      expect(gardioApi.getCrimeStatisticsBenchmark).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchApiCrimeAnalysis', () => {
    it('combina Summary e Benchmark e retorna AnalysisResult completo', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockResolvedValue({
        data: mockSummaryData,
      });
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockResolvedValue({
        data: mockBenchmarkData,
      });

      const analysis = await fetchApiCrimeAnalysis('SAO PAULO', 2026, 7);

      expect(analysis.city).toBe('SAO PAULO');
      expect(analysis.totalOccurrences).toBe(31750);
      expect(analysis.benchmark?.stateTotal).toBe(90319);
      expect(analysis.insights.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('propaga erro sem fallback quando Summary falhar', async () => {
      const error404 = new ApiError({
        kind: 'http',
        status: 404,
        message: 'Município não encontrado',
      });
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockRejectedValue(error404);
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockResolvedValue({
        data: mockBenchmarkData,
      });

      await expect(fetchApiCrimeAnalysis('XYZ', 2026, 7)).rejects.toThrow(error404);
    });
  });

  describe('Validação de Consistência de Períodos e Cache', () => {
    it('Cenário 1: rejeita quando Summary retorna período diferente do solicitado', async () => {
      const mismatchedSummary: MunicipalitySummary = {
        ...mockSummaryData,
        year: 2026,
        month: 6, // Mês divergente (solicitado: 7)
        period: '2026-06',
      };

      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockResolvedValue({
        data: mismatchedSummary,
      });
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockResolvedValue({
        data: mockBenchmarkData,
      });

      await expect(fetchApiCrimeAnalysis('SAO PAULO', 2026, 7)).rejects.toThrow(
        PeriodMismatchError
      );
    });

    it('Cenário 2: rejeita quando Benchmark retorna período diferente do solicitado', async () => {
      const mismatchedBenchmark: StatewideBenchmark = {
        ...mockBenchmarkData,
        year: 2026,
        month: 6, // Mês divergente (solicitado: 7)
        period: '2026-06',
      };

      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockResolvedValue({
        data: mockSummaryData,
      });
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockResolvedValue({
        data: mismatchedBenchmark,
      });

      await expect(fetchApiCrimeAnalysis('SAO PAULO', 2026, 7)).rejects.toThrow(
        PeriodMismatchError
      );
    });

    it('Cenário 3: rejeita quando Summary e Benchmark retornam períodos diferentes entre si', () => {
      const juneBenchmark: StatewideBenchmark = {
        ...mockBenchmarkData,
        year: 2026,
        month: 6,
        period: '2026-06',
      };

      expect(() =>
        mapApiAnalyticsToAnalysisResult(mockSummaryData, juneBenchmark)
      ).toThrow(PeriodMismatchError);
    });

    it('Cache: respostas incompatíveis não são cacheadas e nova tentativa busca novamente a API', async () => {
      const invalidSummary: MunicipalitySummary = {
        ...mockSummaryData,
        year: 2026,
        month: 5,
        period: '2026-05',
      };

      const summarySpy = jest
        .spyOn(gardioApi, 'getCrimeStatisticsSummary')
        .mockResolvedValueOnce({ data: invalidSummary }) // 1ª tentativa: resposta com período incompatível
        .mockResolvedValueOnce({ data: mockSummaryData }); // 2ª tentativa: resposta correta

      // 1ª tentativa deve falhar e não armazenar no cache
      await expect(fetchSummaryWithDeduplication('SAO PAULO', 2026, 7)).rejects.toThrow(
        PeriodMismatchError
      );

      // 2ª tentativa deve disparar uma nova requisição à API e ter sucesso
      const validResult = await fetchSummaryWithDeduplication('SAO PAULO', 2026, 7);
      expect(validResult.month).toBe(7);
      expect(summarySpy).toHaveBeenCalledTimes(2);
    });
  });
});

