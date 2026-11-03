/**
 * src/services/api/__tests__/guards.test.ts
 * Testes unitários para os validadores manuais de contrato de dados.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isLegacySspPayload,
  isAvailablePeriod,
  isPeriodsResponse,
  isHealthReadyResponse,
  isTopCrimeItem,
  isMunicipalitySummary,
  isMunicipalitySummaryResponse,
  isStatewideBenchmark,
  isStatewideBenchmarkResponse,
} from '../guards';

describe('src/services/api/guards.ts', () => {
  describe('isLegacySspPayload', () => {
    const validPayload = {
      'S.PAULO': {
        'HOMICÍDIO DOLOSO': {
          quantidade: 1,
          localizacoes: [{ latitude: -23.5505, longitude: -46.6333 }],
        },
        'ROUBO DE VEÍCULO': {
          quantidade: 5,
          localizacoes: [],
        },
      },
      'CAMPINAS': {
        'FURTO - OUTROS': {
          quantidade: 12,
          localizacoes: [{ latitude: -22.9056, longitude: -47.0608 }],
        },
      },
    };

    it('aceita payload legado válido e completo', () => {
      expect(isLegacySspPayload(validPayload)).toBe(true);
    });

    it('rejeita envelopes de erro do FastAPI (ex: {"detail": "Not Found"})', () => {
      expect(isLegacySspPayload({ detail: 'Not Found' })).toBe(false);
      expect(isLegacySspPayload({ detail: [{ msg: 'Validation error' }] })).toBe(false);
    });

    it('rejeita respostas com envelope "error"', () => {
      expect(
        isLegacySspPayload({ error: { code: 'rate_limit_exceeded', message: 'Muitas reqs' } })
      ).toBe(false);
    });

    it('rejeita objetos vazios, nulos ou primitivos', () => {
      expect(isLegacySspPayload({})).toBe(false);
      expect(isLegacySspPayload(null)).toBe(false);
      expect(isLegacySspPayload(undefined)).toBe(false);
      expect(isLegacySspPayload('texto')).toBe(false);
      expect(isLegacySspPayload(123)).toBe(false);
      expect(isLegacySspPayload([])).toBe(false);
    });

    it('rejeita cidade sem naturezas criminais', () => {
      expect(isLegacySspPayload({ 'S.PAULO': {} })).toBe(false);
    });

    it('rejeita quando quantidade não for numérica', () => {
      const invalid = {
        'S.PAULO': {
          'ROUBO': {
            quantidade: '10' as any,
            localizacoes: [],
          },
        },
      };
      expect(isLegacySspPayload(invalid)).toBe(false);
    });

    it('rejeita quando localizacoes não for array', () => {
      const invalid = {
        'S.PAULO': {
          'ROUBO': {
            quantidade: 2,
            localizacoes: null as any,
          },
        },
      };
      expect(isLegacySspPayload(invalid)).toBe(false);
    });

    it('rejeita quando as coordenadas geográficas não forem numéricas', () => {
      const invalid = {
        'S.PAULO': {
          'ROUBO': {
            quantidade: 1,
            localizacoes: [{ latitude: '-23.55' as any, longitude: -46.63 }],
          },
        },
      };
      expect(isLegacySspPayload(invalid)).toBe(false);
    });
  });

  describe('isAvailablePeriod', () => {
    it('aceita período válido com campos em snake_case', () => {
      const period = {
        year: 2026,
        month: 2,
        period: '2026-02',
        total_occurrences: 90321,
        total_municipalities: 641,
      };
      expect(isAvailablePeriod(period)).toBe(true);
    });

    it('rejeita período com mês fora do intervalo [1, 12]', () => {
      expect(
        isAvailablePeriod({
          year: 2026,
          month: 13,
          period: '2026-13',
          total_occurrences: 10,
          total_municipalities: 5,
        })
      ).toBe(false);
    });

    it('rejeita período com formato de string inválido', () => {
      expect(
        isAvailablePeriod({
          year: 2026,
          month: 2,
          period: '02/2026',
          total_occurrences: 10,
          total_municipalities: 5,
        })
      ).toBe(false);
    });
  });

  describe('isPeriodsResponse', () => {
    it('aceita envelope com lista de períodos válidos', () => {
      const envelope = {
        data: [
          {
            year: 2026,
            month: 2,
            period: '2026-02',
            total_occurrences: 90321,
            total_municipalities: 641,
          },
        ],
        meta: {
          source: 'SSP-SP',
        },
      };
      expect(isPeriodsResponse(envelope)).toBe(true);
    });

    it('aceita envelope com lista vazia de períodos', () => {
      expect(isPeriodsResponse({ data: [] })).toBe(true);
    });

    it('rejeita quando "data" não é array', () => {
      expect(isPeriodsResponse({ data: null })).toBe(false);
      expect(isPeriodsResponse({ data: {} })).toBe(false);
    });

    it('rejeita se algum período na lista for inválido', () => {
      const envelope = {
        data: [
          {
            year: 2026,
            month: 2,
            period: '2026-02',
            total_occurrences: 90321,
            total_municipalities: 641,
          },
          {
            year: 'invalido',
          },
        ],
      };
      expect(isPeriodsResponse(envelope)).toBe(false);
    });
  });

  describe('isHealthReadyResponse', () => {
    it('aceita resposta de prontidão correta', () => {
      const ready = {
        status: 'ready',
        database: 'connected',
        service: 'gardio-api',
      };
      expect(isHealthReadyResponse(ready)).toBe(true);
    });

    it('rejeita status diferente de "ready"', () => {
      expect(
        isHealthReadyResponse({
          status: 'not_ready',
          database: 'connected',
          service: 'gardio-api',
        })
      ).toBe(false);
    });

    it('rejeita database diferente de "connected"', () => {
      expect(
        isHealthReadyResponse({
          status: 'ready',
          database: 'disconnected',
          service: 'gardio-api',
        })
      ).toBe(false);
    });

    it('rejeita objetos incompletos ou nulos', () => {
      expect(isHealthReadyResponse(null)).toBe(false);
      expect(isHealthReadyResponse({})).toBe(false);
    });
  });

  /* ====================================================================== */
  /* Novos Guards: TopCrimeItem, MunicipalitySummary e StatewideBenchmark   */
  /* ====================================================================== */

  describe('isTopCrimeItem', () => {
    const validTopCrime = {
      nature_code: 'furto_outros',
      nature_name: 'Furto - Outros',
      category: 'patrimonio',
      quantity: 14200,
      percentage: 44.72,
    };

    it('aceita item válido', () => {
      expect(isTopCrimeItem(validTopCrime)).toBe(true);
    });

    it('aceita valores numéricos zero', () => {
      expect(
        isTopCrimeItem({
          ...validTopCrime,
          quantity: 0,
          percentage: 0,
        })
      ).toBe(true);
    });

    it('rejeita campos obrigatórios ausentes ou vazios', () => {
      expect(isTopCrimeItem({ ...validTopCrime, nature_code: '' })).toBe(false);
      expect(isTopCrimeItem({ ...validTopCrime, nature_name: '' })).toBe(false);
      expect(isTopCrimeItem({ ...validTopCrime, category: '' })).toBe(false);
    });

    it('rejeita tipos incorretos ou números negativos', () => {
      expect(isTopCrimeItem({ ...validTopCrime, quantity: -1 })).toBe(false);
      expect(isTopCrimeItem({ ...validTopCrime, percentage: -0.5 })).toBe(false);
      expect(isTopCrimeItem({ ...validTopCrime, quantity: '10' as any })).toBe(false);
      expect(isTopCrimeItem(null)).toBe(false);
      expect(isTopCrimeItem({})).toBe(false);
    });
  });

  describe('isMunicipalitySummary', () => {
    const validSummary = {
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

    it('aceita resumo municipal válido e completo', () => {
      expect(isMunicipalitySummary(validSummary)).toBe(true);
    });

    it('aceita campos nullable quando nulos (population_2022 e rate_per_100k)', () => {
      const summaryWithNulls = {
        ...validSummary,
        population_2022: null,
        rate_per_100k: null,
      };
      expect(isMunicipalitySummary(summaryWithNulls)).toBe(true);
    });

    it('aceita valores numéricos zero', () => {
      const summaryZero = {
        ...validSummary,
        total_occurrences: 0,
        rate_per_100k: 0,
        category_totals: { vida: 0, integridade_fisica: 0, patrimonio: 0, outros: 0 },
        category_shares: { vida: 0, integridade_fisica: 0, patrimonio: 0, outros: 0 },
        top_crimes: [],
      };
      expect(isMunicipalitySummary(summaryZero)).toBe(true);
    });

    it('preserva compatibilidade mesmo com propriedades extras não mapeadas', () => {
      const summaryWithExtra = {
        ...validSummary,
        extra_debug_field: 'valor_adicional',
      };
      expect(isMunicipalitySummary(summaryWithExtra)).toBe(true);
    });

    it('rejeita quando campo obrigatório está ausente', () => {
      const { municipality_key, ...missingKey } = validSummary;
      expect(isMunicipalitySummary(missingKey)).toBe(false);

      const { total_occurrences, ...missingTotal } = validSummary;
      expect(isMunicipalitySummary(missingTotal)).toBe(false);
    });

    it('rejeita formato de período inválido', () => {
      expect(isMunicipalitySummary({ ...validSummary, period: '2026/07' })).toBe(false);
      expect(isMunicipalitySummary({ ...validSummary, period: 'jul-2026' })).toBe(false);
    });

    it('rejeita mês fora do intervalo [1, 12]', () => {
      expect(isMunicipalitySummary({ ...validSummary, month: 0 })).toBe(false);
      expect(isMunicipalitySummary({ ...validSummary, month: 13 })).toBe(false);
    });

    it('rejeita category_totals ou category_shares com valores não numéricos', () => {
      expect(
        isMunicipalitySummary({
          ...validSummary,
          category_totals: { vida: '412' as any },
        })
      ).toBe(false);

      expect(
        isMunicipalitySummary({
          ...validSummary,
          category_shares: { vida: -1 },
        })
      ).toBe(false);
    });

    it('rejeita top_crimes contendo itens inválidos', () => {
      expect(
        isMunicipalitySummary({
          ...validSummary,
          top_crimes: [{ invalid: true } as any],
        })
      ).toBe(false);
    });
  });

  describe('isMunicipalitySummaryResponse', () => {
    const validSummary = {
      municipality_key: 'SAO PAULO',
      municipality_name: 'São Paulo',
      year: 2026,
      month: 7,
      period: '2026-07',
      population_2022: 11451245,
      total_occurrences: 31750,
      rate_per_100k: 277.26,
      category_totals: { vida: 412, integridade_fisica: 2890, patrimonio: 25110, outros: 3338 },
      category_shares: { vida: 1.3, integridade_fisica: 9.1, patrimonio: 79.08, outros: 10.51 },
      top_crimes: [],
    };

    it('aceita envelope válido com data e meta', () => {
      const response = {
        data: validSummary,
        meta: {
          period: '2026-07',
          dataset_id: 'ssp_sp_criminal_statistics',
        },
      };
      expect(isMunicipalitySummaryResponse(response)).toBe(true);
    });

    it('rejeita envelopes de erro do backend (detail ou error)', () => {
      expect(isMunicipalitySummaryResponse({ detail: 'Município não encontrado' })).toBe(false);
      expect(
        isMunicipalitySummaryResponse({
          error: { code: 'not_found', message: 'Município não encontrado' },
        })
      ).toBe(false);
    });

    it('rejeita quando data é ausente ou inválido', () => {
      expect(isMunicipalitySummaryResponse({ data: null })).toBe(false);
      expect(isMunicipalitySummaryResponse({ data: {} })).toBe(false);
      expect(isMunicipalitySummaryResponse(null)).toBe(false);
    });
  });

  describe('isStatewideBenchmark', () => {
    const validBenchmark = {
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

    it('aceita benchmark estadual válido com rate_per_100k nulo e covered_rate_per_100k preenchido', () => {
      expect(isStatewideBenchmark(validBenchmark)).toBe(true);
    });

    it('aceita todos os campos opcionais e calculados como nulos', () => {
      const allNulls = {
        ...validBenchmark,
        state_population: null,
        rate_per_100k: null,
        covered_municipalities: null,
        covered_population: null,
        covered_rate_per_100k: null,
      };
      expect(isStatewideBenchmark(allNulls)).toBe(true);
    });

    it('aceita rate_per_100k numérico quando a cobertura for total (100%)', () => {
      const fullCoverage = {
        ...validBenchmark,
        rate_per_100k: 203.38,
      };
      expect(isStatewideBenchmark(fullCoverage)).toBe(true);
    });

    it('aceita valores numéricos zero', () => {
      const benchmarkZero = {
        ...validBenchmark,
        total_occurrences: 0,
        covered_municipalities: 0,
        covered_population: 0,
        covered_rate_per_100k: 0,
      };
      expect(isStatewideBenchmark(benchmarkZero)).toBe(true);
    });

    it('rejeita quando campo obrigatório está ausente', () => {
      const { state, ...missingState } = validBenchmark;
      expect(isStatewideBenchmark(missingState)).toBe(false);

      const { total_occurrences, ...missingOccurrences } = validBenchmark;
      expect(isStatewideBenchmark(missingOccurrences)).toBe(false);
    });

    it('rejeita números negativos para taxas ou contagens', () => {
      expect(isStatewideBenchmark({ ...validBenchmark, total_occurrences: -10 })).toBe(false);
      expect(isStatewideBenchmark({ ...validBenchmark, covered_rate_per_100k: -1.5 })).toBe(false);
      expect(isStatewideBenchmark({ ...validBenchmark, covered_municipalities: -1 })).toBe(false);
    });

    it('preserva compatibilidade com propriedades extras não mapeadas', () => {
      expect(isStatewideBenchmark({ ...validBenchmark, future_stat: 123 })).toBe(true);
    });
  });

  describe('isStatewideBenchmarkResponse', () => {
    const validBenchmark = {
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
      category_totals: { vida: 1150, integridade_fisica: 10240, patrimonio: 68900, outros: 10029 },
      category_shares: { vida: 1.27, integridade_fisica: 11.34, patrimonio: 76.29, outros: 11.1 },
    };

    it('aceita envelope válido com data e meta', () => {
      const response = {
        data: validBenchmark,
        meta: {
          period: '2026-07',
          dataset_id: 'ssp_sp_criminal_statistics',
        },
      };
      expect(isStatewideBenchmarkResponse(response)).toBe(true);
    });

    it('rejeita envelopes de erro do backend (detail ou error)', () => {
      expect(isStatewideBenchmarkResponse({ detail: 'Período não disponível' })).toBe(false);
      expect(
        isStatewideBenchmarkResponse({
          error: { code: 'server_error', message: 'Falha interna' },
        })
      ).toBe(false);
    });

    it('rejeita quando data é ausente ou inválido', () => {
      expect(isStatewideBenchmarkResponse({ data: null })).toBe(false);
      expect(isStatewideBenchmarkResponse({ data: 'string' })).toBe(false);
      expect(isStatewideBenchmarkResponse(null)).toBe(false);
    });
  });
});
