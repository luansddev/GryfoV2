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
});
