/**
 * src/hooks/__tests__/useCrimeAnalysis.test.ts
 * Testes unitários para o hook useCrimeAnalysis, validando o chaveamento analítico
 * por fonte (API vs Firebase) e por tipo de período (ativo vs compatibilidade).
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import { useCrimeAnalysis, CrimeAnalysisOptions } from '../useCrimeAnalysis';
import * as CrimeHistoryService from '../../services/analytics/CrimeHistoryService';
import * as apiAnalysisAdapter from '../../services/analytics/apiAnalysisAdapter';
import * as gardioApi from '../../services/api/gardioApi';
import { ApiError } from '../../services/api/httpClient';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../services/analytics/PopulationService', () => ({
  getPopulationForCity: jest.fn().mockResolvedValue(11451245 as never),
}));

jest.mock('../../services/analytics/CityDirectory', () => {
  const actual = jest.requireActual('../../services/analytics/CityDirectory') as any;
  return {
    ...actual,
    loadIbgeCities: jest.fn().mockResolvedValue({} as never),
    getIbgeCityForSspKey: jest.fn().mockReturnValue({ population: 11451245 } as never),
    getCityDisplayName: jest.fn().mockReturnValue('São Paulo' as never),
    resolveSspKey: jest.fn((c: string) => c),
  };
});

describe('src/hooks/useCrimeAnalysis.ts', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  const mockFeb2026Data = {
    'SAO PAULO': {
      'HOMICÍDIO DOLOSO': {
        quantidade: 10,
        localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
      },
      'ROUBO DE VEÍCULO': {
        quantidade: 50,
        localizacoes: [],
      },
    },
  };

  const mockApiSummary = {
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
    ],
  };

  const mockApiBenchmark = {
    state: 'SP',
    year: 2026,
    month: 7,
    period: '2026-07',
    total_occurrences: 90319,
    state_population: 44411238,
    rate_per_100k: null,
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
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);

    apiAnalysisAdapter.clearApiAnalysisCache();
    CrimeHistoryService.clearPeriodsCache();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.spyOn(gardioApi, 'getPeriods').mockResolvedValue({
      data: [
        {
          year: 2026,
          month: 7,
          period: '2026-07',
          type: 'active',
          isCompatibilityFixture: false,
          total_occurrences: 90319,
          total_municipalities: 641,
        },
      ],
      meta: {
        total_active_periods: 1,
        latest_active_period: '2026-07',
        generated_at: '2026-11-02T10:00:00Z',
      },
    } as any);

    // Default mock: fetchAvailablePeriods returns 2026-07 as active in API mode
    jest.spyOn(CrimeHistoryService, 'fetchAvailablePeriods').mockImplementation(async () => [
      {
        year: 2026,
        month: 7,
        period: '2026-07',
        type: 'active',
        isCompatibilityFixture: false,
        total_occurrences: 90319,
        total_municipalities: 641,
      },
      {
        year: 2026,
        month: 2,
        period: '2026-02',
        type: 'compatibility',
        isCompatibilityFixture: true,
      },
    ]);

    // Default mock: fetchAvailableHistory returns Feb 2026
    jest.spyOn(CrimeHistoryService, 'fetchAvailableHistory').mockResolvedValue([
      {
        year: 2026,
        month: 2,
        data: mockFeb2026Data,
      },
    ]);
  });

  afterEach(() => {
    apiAnalysisAdapter.clearApiAnalysisCache();
    CrimeHistoryService.clearPeriodsCache();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  // Helper para renderizar e capturar o estado do hook
  async function renderHookState(
    city: string | null,
    options?: CrimeAnalysisOptions
  ): Promise<ReturnType<typeof useCrimeAnalysis>> {
    let latestState: ReturnType<typeof useCrimeAnalysis> = null as any;

    function TestComponent(props: { c: string | null; opt?: CrimeAnalysisOptions }) {
      const state = useCrimeAnalysis(props.c, props.opt);
      latestState = state;
      return null;
    }

    let root: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      root = ReactTestRenderer.create(
        React.createElement(TestComponent, { c: city, opt: options })
      );
    });

    // Aguarda resolução de microtasks assíncronas do useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    return latestState;
  }

  describe('Cenários de Período Ativo / API', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
    });

    it('consome Summary e Benchmark da API para período ativo explícito (07/2026)', async () => {
      const summarySpy = jest
        .spyOn(gardioApi, 'getCrimeStatisticsSummary')
        .mockResolvedValue({ data: mockApiSummary } as any);
      const benchmarkSpy = jest
        .spyOn(gardioApi, 'getCrimeStatisticsBenchmark')
        .mockResolvedValue({ data: mockApiBenchmark } as any);

      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 7 },
      });

      expect(summarySpy).toHaveBeenCalledWith('SAO PAULO', 2026, 7);
      expect(benchmarkSpy).toHaveBeenCalledWith(2026, 7);

      expect(state.error).toBeNull();
      expect(state.analysis).toBeDefined();
      expect(state.analysis?.totalOccurrences).toBe(31750);
      expect(state.analysis?.ratePer100k).toBe(277.26);
      expect(state.analysis?.population).toBe(11451245);
      expect(state.analysis?.dataQuality.lastPeriod).toBe('07/2026');
      expect(state.analysis?.benchmark?.isPartialCoverage).toBe(true);
      expect(state.analysis?.benchmark?.coveredRatePer100k).toBe(203.38);
      expect(state.analysis?.benchmark?.coveredMunicipalities).toBe(626);
      expect(state.analysis?.benchmark?.coveredPopulation).toBe(44358687);
      expect(state.analysis?.benchmark?.stateRatePer100k).toBeUndefined();
    });

    it('preserva campos nullable como undefined sem converter null para zero', async () => {
      const summaryNulls = {
        ...mockApiSummary,
        population_2022: null,
        rate_per_100k: null,
      };

      jest
        .spyOn(gardioApi, 'getCrimeStatisticsSummary')
        .mockResolvedValue({ data: summaryNulls } as any);
      jest
        .spyOn(gardioApi, 'getCrimeStatisticsBenchmark')
        .mockResolvedValue({ data: mockApiBenchmark } as any);

      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 7 },
      });

      expect(state.analysis?.population).toBeUndefined();
      expect(state.analysis?.ratePer100k).toBeUndefined();
      expect(state.analysis?.dataQuality.hasPopulation).toBe(false);
    });
  });

  describe('Cenários de Compatibilidade / Firebase / Preservação de Fevereiro', () => {
    it('mantém métricas locais para fevereiro de 2026 quando o período for omitido (padrão legado)', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      const summarySpy = jest.spyOn(gardioApi, 'getCrimeStatisticsSummary');
      const benchmarkSpy = jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark');

      const state = await renderHookState('SAO PAULO');

      // Não deve chamar Summary nem Benchmark da API
      expect(summarySpy).not.toHaveBeenCalled();
      expect(benchmarkSpy).not.toHaveBeenCalled();

      // Deve processar as métricas locais de fevereiro
      expect(state.error).toBeNull();
      expect(state.analysis?.dataQuality.lastPeriod).toBe('02/2026');
      expect(state.analysis?.totalOccurrences).toBe(60); // 10 + 50 do mockFeb2026Data
    });

    it('mantém métricas locais para fevereiro de 2026 quando explicitamente solicitado (período de compatibilidade)', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      const summarySpy = jest.spyOn(gardioApi, 'getCrimeStatisticsSummary');
      const benchmarkSpy = jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark');

      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 2 },
      });

      expect(summarySpy).not.toHaveBeenCalled();
      expect(benchmarkSpy).not.toHaveBeenCalled();
      expect(state.analysis?.dataQuality.lastPeriod).toBe('02/2026');
    });

    it('mantém métricas locais quando a fonte for Firebase, mesmo se 07/2026 for solicitado', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'firebase';
      const summarySpy = jest.spyOn(gardioApi, 'getCrimeStatisticsSummary');
      const benchmarkSpy = jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark');

      // Firebase não tem dados de julho, logo deve resultar em not_found sem chamar a API
      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 7 },
      });

      expect(summarySpy).not.toHaveBeenCalled();
      expect(benchmarkSpy).not.toHaveBeenCalled();
      expect(state.error).toBe('not_found');
      expect(state.analysis).toBeNull();
    });

    it('executa a composição real do fallback API → Firebase pelo hook com cálculo via MetricsEngine', async () => {
      // 1. Configura fonte como 'api'
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';

      // 2. Restaura fetchAvailableHistory para executar a lógica REAL do CrimeHistoryService
      const historySpy = jest.spyOn(CrimeHistoryService, 'fetchAvailableHistory');
      historySpy.mockRestore();

      // 3. Mocks nos clientes externos (API legado falha com 503; Firebase responde 200)
      const summarySpy = jest.spyOn(gardioApi, 'getCrimeStatisticsSummary');
      const benchmarkSpy = jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark');
      const legacySpy = jest.spyOn(gardioApi, 'getLegacyPeriod').mockRejectedValue(
        new ApiError({
          kind: 'http',
          status: 503,
          message: 'Service Temporarily Unavailable',
        })
      );

      const mockFirebaseData = {
        'SAO PAULO': {
          'HOMICÍDIO DOLOSO': {
            quantidade: 15,
            localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
          },
          'ROUBO - OUTROS': {
            quantidade: 85,
            localizacoes: [{ latitude: -23.56, longitude: -46.64 }],
          },
        },
      };

      const fetchSpy = jest.fn<any>().mockImplementation((url: any) => {
        if (typeof url === 'string' && url.includes('ssp-2-2026.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockFirebaseData,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
      (global as any).fetch = fetchSpy;

      // 4. Renderiza o hook solicitando explicitamente fevereiro de 2026 (compatibilidade)
      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 2 },
      });

      // 5. Validações da composição do fallback:
      // A requisição legada à API foi executada e falhou com 503
      expect(legacySpy).toHaveBeenCalledWith(2, 2026);

      // CrimeHistoryService acionou o fallback para Firebase Hosting
      expect(fetchSpy).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');

      // Summary e Benchmark da API NÃO foram acionados para fevereiro
      expect(summarySpy).not.toHaveBeenCalled();
      expect(benchmarkSpy).not.toHaveBeenCalled();

      // O hook recebeu os dados do Firebase e o MetricsEngine calculou as estatísticas
      expect(state.error).toBeNull();
      expect(state.analysis).toBeDefined();
      expect(state.analysis?.totalOccurrences).toBe(100); // 15 + 85
      expect(state.analysis?.dominantCategory).toBe('patrimony');
      expect(state.analysis?.dataQuality.lastPeriod).toBe('02/2026');
      expect(state.analysis?.categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'patrimony', total: 85 }),
          expect.objectContaining({ id: 'life', total: 15 }),
        ])
      );
    });
  });

  describe('Tratamento de Erros e Isolamento de Períodos', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
    });

    it('trata HTTP 404 da Summary como not_found (não vira zero ocorrências nem mistura períodos)', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockRejectedValue(
        new ApiError({
          kind: 'http',
          status: 404,
          message: 'Município não encontrado',
        })
      );
      jest.spyOn(gardioApi, 'getCrimeStatisticsBenchmark').mockResolvedValue({
        data: mockApiBenchmark,
      } as any);

      const state = await renderHookState('CIDADE_INEXISTENTE', {
        period: { year: 2026, month: 7 },
      });

      expect(state.error).toBe('not_found');
      expect(state.analysis).toBeNull();
    });

    it('trata HTTP 422 da API como error sem acionar fallback indevido para fevereiro', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockRejectedValue(
        new ApiError({
          kind: 'http',
          status: 422,
          message: 'Parâmetros conflitantes',
        })
      );

      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 7 },
      });

      expect(state.error).toBe('error');
      expect(state.analysis).toBeNull();
    });

    it('trata falha de rede na API como error sem misturar com dados de fevereiro', async () => {
      jest.spyOn(gardioApi, 'getCrimeStatisticsSummary').mockRejectedValue(
        new ApiError({
          kind: 'network',
          message: 'Conexão recusada',
        })
      );

      const state = await renderHookState('SAO PAULO', {
        period: { year: 2026, month: 7 },
      });

      expect(state.error).toBe('error');
      expect(state.analysis).toBeNull();
    });

    it('retorna not_found para período desconhecido não catalogado (ex: 01/2025)', async () => {
      const state = await renderHookState('SAO PAULO', {
        period: { year: 2025, month: 1 },
      });

      expect(state.error).toBe('not_found');
      expect(state.analysis).toBeNull();
    });

    it('limpa análise e erro quando cidade for nula', async () => {
      const state = await renderHookState(null);

      expect(state.analysis).toBeNull();
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
    });
  });
});
