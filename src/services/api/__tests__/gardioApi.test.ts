/**
 * src/services/api/__tests__/gardioApi.test.ts
 * Testes unitários para o serviço de consumo dos endpoints da Gardio Intelligence API.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import {
  getLegacyPeriod,
  getPeriods,
  getHealth,
} from '../gardioApi';

describe('src/services/api/gardioApi.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(status: number, body: unknown) {
    const textBody = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        get: () => null,
      },
      text: async () => textBody,
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    } as unknown as Response;
  }

  describe('getLegacyPeriod', () => {
    const mockLegacyData = {
      'S.PAULO': {
        'HOMICÍDIO DOLOSO': {
          quantidade: 10,
          localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
        },
      },
    };

    it('requisita o endpoint no formato exato /ssp-{month}-{year}.json', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockLegacyData));

      const result = await getLegacyPeriod(2, 2026, {
        baseUrl: 'http://localhost:8000',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/ssp-2-2026.json',
        expect.any(Object)
      );
      expect(result).toEqual(mockLegacyData);
    });

    it('rejeita mês inválido antes de disparar a requisição', async () => {
      (global as any).fetch = jest.fn<any>();

      await expect(getLegacyPeriod(0, 2026)).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('Mês inválido'),
      });

      await expect(getLegacyPeriod(13, 2026)).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('Mês inválido'),
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejeita ano inválido antes de disparar a requisição', async () => {
      (global as any).fetch = jest.fn<any>();

      await expect(getLegacyPeriod(2, 1999)).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('Ano inválido'),
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('lança ApiError com kind invalid_response se a resposta não seguir a estrutura legado', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, { detail: 'Período não publicado' })
      );

      await expect(
        getLegacyPeriod(2, 2026, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
      });
    });
  });

  describe('getPeriods', () => {
    const mockPeriods = {
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

    it('requisita /v1/periods e valida o envelope de resposta', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockPeriods));

      const result = await getPeriods({ baseUrl: 'http://localhost:8000' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/v1/periods',
        expect.any(Object)
      );
      expect(result).toEqual(mockPeriods);
    });

    it('lança invalid_response se os períodos tiverem estrutura incorreta', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, { data: 'não é array' })
      );

      await expect(
        getPeriods({ baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
      });
    });
  });

  describe('getHealth', () => {
    const mockHealth = {
      status: 'ready',
      database: 'connected',
      service: 'gardio-api',
    };

    it('requisita /health/ready e valida o formato de prontidão', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockHealth));

      const result = await getHealth({ baseUrl: 'http://localhost:8000' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/health/ready',
        expect.any(Object)
      );
      expect(result).toEqual(mockHealth);
    });

    it('rejeita respostas com banco desconectado', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, {
          status: 'ready',
          database: 'disconnected',
          service: 'gardio-api',
        })
      );

      await expect(
        getHealth({ baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
      });
    });
  });
});
