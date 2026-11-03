/**
 * src/services/analytics/__tests__/CrimeHistoryService.test.ts
 * Testes unitários para a integração do CrimeHistoryService com a Gardio API e fallback para Firebase.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import { ApiError } from '../../api/httpClient';

// Mock do serviço gardioApi
jest.mock('../../api/gardioApi', () => ({
  getLegacyPeriod: jest.fn(),
  getPeriods: jest.fn(),
}));

describe('src/services/analytics/CrimeHistoryService.ts', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  let getLegacyPeriodMock: jest.MockedFunction<typeof import('../../api/gardioApi').getLegacyPeriod>;
  let getPeriodsMock: jest.MockedFunction<typeof import('../../api/gardioApi').getPeriods>;

  const mockCrimeData = {
    'S.PAULO': {
      'HOMICÍDIO DOLOSO': {
        quantidade: 10,
        localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
      },
    },
  };

  function mockFetchResponse(status: number, body: unknown) {
    const isStr = typeof body === 'string';
    const textBody = isStr ? body : JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
      headers: {
        get: () => null,
      },
      text: async () => textBody,
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    } as unknown as Response;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Carrega o mock de getLegacyPeriod
    const gardioApiModule = require('../../api/gardioApi');
    getLegacyPeriodMock = gardioApiModule.getLegacyPeriod as any;
    getLegacyPeriodMock.mockReset();
    getPeriodsMock = gardioApiModule.getPeriods as any;
    getPeriodsMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  // Função utilitária para carregar uma instância isolada do serviço
  function getService(): typeof import('../CrimeHistoryService') {
    return require('../CrimeHistoryService');
  }

  describe('Cenários 1 e 2: Fonte "firebase"', () => {
    it('Cenário 1: utiliza o endpoint original do Firebase quando a fonte for firebase', async () => {
      delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE; // Padrão 'firebase'
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockFetchResponse(200, mockCrimeData));

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 2: não chama getLegacyPeriod quando a fonte for firebase', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'firebase';
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockFetchResponse(200, mockCrimeData));

      const service = getService();
      await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cenários 3, 4 e 5: Fonte "api" bem-sucedida', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
    });

    it('Cenário 3: chama getLegacyPeriod com mês e ano na ordem correta (month, year)', async () => {
      getLegacyPeriodMock.mockResolvedValueOnce(mockCrimeData as any);
      (global as any).fetch = jest.fn<any>();

      const service = getService();
      await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledWith(2, 2026);
    });

    it('Cenário 4: retorna os dados da Gardio API quando a requisição for bem-sucedida', async () => {
      getLegacyPeriodMock.mockResolvedValueOnce(mockCrimeData as any);
      (global as any).fetch = jest.fn<any>();

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 5: não consulta o Firebase quando a Gardio API responde corretamente', async () => {
      getLegacyPeriodMock.mockResolvedValueOnce(mockCrimeData as any);
      (global as any).fetch = jest.fn<any>();

      const service = getService();
      await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cenários 6 a 11: Falhas recuperáveis acionam fallback para Firebase', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockFetchResponse(200, mockCrimeData));
    });

    it('Cenário 6: aciona fallback para Firebase em caso de erro de conexão (network)', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'network', message: 'Falha de conexão com a API' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 7: aciona fallback para Firebase em caso de timeout', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'timeout', message: 'Timeout de 10s excedido' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 8: aciona fallback para Firebase em caso de HTTP 404 da API', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'http', status: 404, message: 'Período não publicado' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 9: aciona fallback para Firebase em caso de HTTP 429 da API', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'http', status: 429, message: 'Rate limit excedido' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 10: aciona fallback para Firebase em caso de HTTP 5xx da API', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'http', status: 500, message: 'Internal Server Error' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });

    it('Cenário 11: aciona fallback para Firebase em caso de resposta com estrutura inválida', async () => {
      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'invalid_response', message: 'Payload incompatível com o contrato' })
      );

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://gryfocorp.web.app/ssp-2-2026.json');
      expect(result).toEqual(mockCrimeData);
    });
  });

  describe('Cenários 12 a 15: Erros não recuperáveis NÃO acionam fallback', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      (global as any).fetch = jest.fn<any>();
    });

    it('Cenário 12: cancelamento explícito (aborted) não executa fallback', async () => {
      const abortError = new ApiError({
        kind: 'aborted',
        message: 'A requisição foi cancelada pelo consumidor.',
      });
      getLegacyPeriodMock.mockRejectedValueOnce(abortError);

      const service = getService();
      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(abortError);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Cenário 13: erro de configuração (URL ausente/inválida) não executa fallback', async () => {
      const configError = new Error(
        'A URL da Gardio Intelligence API não foi informada. Defina EXPO_PUBLIC_GARDIO_API_URL.'
      );
      getLegacyPeriodMock.mockRejectedValueOnce(configError);

      const service = getService();
      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(configError);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Cenário 14: HTTP 401/403 não executa fallback', async () => {
      const authError = new ApiError({ kind: 'http', status: 401, message: 'Unauthorized' });
      getLegacyPeriodMock.mockRejectedValueOnce(authError);

      const service = getService();
      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(authError);

      expect(global.fetch).not.toHaveBeenCalled();

      const forbiddenError = new ApiError({ kind: 'http', status: 403, message: 'Forbidden' });
      getLegacyPeriodMock.mockRejectedValueOnce(forbiddenError);

      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(forbiddenError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Cenário 15: HTTP 400/422 não executa fallback', async () => {
      const badRequestError = new ApiError({ kind: 'http', status: 400, message: 'Bad Request' });
      getLegacyPeriodMock.mockRejectedValueOnce(badRequestError);

      const service = getService();
      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(badRequestError);

      expect(global.fetch).not.toHaveBeenCalled();

      const unprocessableError = new ApiError({
        kind: 'http',
        status: 422,
        message: 'Unprocessable Entity',
      });
      getLegacyPeriodMock.mockRejectedValueOnce(unprocessableError);

      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(unprocessableError);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cenários 16 e 17: Comportamento do Firebase', () => {
    it('Cenário 16: preserva retorno null quando o Firebase responde HTTP 404', async () => {
      delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE;
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockFetchResponse(404, 'Not Found'));

      const service = getService();
      const result = await service.fetchCrimeDataForPeriod(2, 2026);

      expect(result).toBeNull();
    });

    it('Cenário 17: propaga o erro original do Firebase quando este falha durante o fallback', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';

      getLegacyPeriodMock.mockRejectedValueOnce(
        new ApiError({ kind: 'network', message: 'API offline' })
      );

      (global as any).fetch = jest
        .fn<any>()
        .mockResolvedValue(mockFetchResponse(500, 'Firebase Server Error'));

      const service = getService();
      await expect(service.fetchCrimeDataForPeriod(2, 2026)).rejects.toThrow(
        /Failed to fetch data for 2\/2026/
      );
    });
  });

  describe('Cenários 18 e 19: Cache e Deduplicação em getCrimeData', () => {
    it('Cenário 18: não repete requisição já armazenada no cache (forceRefresh = false)', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';

      getLegacyPeriodMock.mockResolvedValue(mockCrimeData as any);
      (global as any).fetch = jest.fn<any>();

      const service = getService();

      // Primeira chamada: busca via API
      const result1 = await service.getCrimeData(2, 2026);
      expect(result1).toEqual(mockCrimeData);
      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);

      // Segunda chamada: deve retornar do cache sem chamar getLegacyPeriod novamente
      const result2 = await service.getCrimeData(2, 2026);
      expect(result2).toEqual(mockCrimeData);
      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);

      // Terceira chamada com forceRefresh = true: deve disparar nova requisição
      const result3 = await service.getCrimeData(2, 2026, true);
      expect(result3).toEqual(mockCrimeData);
      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(2);
    });

    it('Cenário 19: chamadas simultâneas para o mesmo período não duplicam requisições (deduplicação)', async () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';

      // Simula uma resposta com pequena latência
      getLegacyPeriodMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockCrimeData as any), 20);
          })
      );
      (global as any).fetch = jest.fn<any>();

      const service = getService();

      // Duas chamadas simultâneas
      const [res1, res2] = await Promise.all([
        service.getCrimeData(2, 2026),
        service.getCrimeData(2, 2026),
      ]);

      expect(res1).toEqual(mockCrimeData);
      expect(res2).toEqual(mockCrimeData);
      // Deve ter chamado getLegacyPeriod apenas UMA vez graças à deduplicação
      expect(getLegacyPeriodMock).toHaveBeenCalledTimes(1);
    });
  });


  describe('Cenários 20 a 27: fetchAvailablePeriods() - Descoberta Dinâmica de Períodos', () => {
    const mockApiResponse = {
      data: [
        {
          year: 2026,
          month: 7,
          period: '2026-07',
          total_occurrences: 90319,
          total_municipalities: 641,
        },
      ],
      meta: {
        dataset_id: 'ssp_sp_criminal_statistics',
        source: 'ssp_sp',
      },
    };

    describe('Cenário 20 (Cenário 1 da Etapa 8.1): Fonte API - consulta getPeriods() e retorna período ativo informado', () => {
      it('retorna os períodos com type="active" e metadados preservados', async () => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
        getPeriodsMock.mockResolvedValueOnce(mockApiResponse as any);

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual([
          {
            year: 2026,
            month: 7,
            period: '2026-07',
            type: 'active',
            isCompatibilityFixture: false,
            total_occurrences: 90319,
            total_municipalities: 641,
            metadata: {
              dataset_id: 'ssp_sp_criminal_statistics',
              source: 'ssp_sp',
            },
          },
        ]);
      });
    });

    describe('Cenário 21 (Cenário 2 da Etapa 8.1): Fonte API - não apresenta fevereiro como ativo quando o backend retorna somente julho', () => {
      it('garante que fevereiro não consta como período ativo na lista retornada pela API', async () => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
        getPeriodsMock.mockResolvedValueOnce(mockApiResponse as any);

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        const feb = periods.find((p) => p.month === 2 && p.year === 2026);
        expect(feb).toBeUndefined();

        // Todos os períodos retornados devem ter type === 'active' e isCompatibilityFixture === false
        expect(periods.every((p) => p.type === 'active' && !p.isCompatibilityFixture)).toBe(true);
      });
    });

    describe('Cenário 22 (Cenário 3 da Etapa 8.1): Fonte Firebase - retorna fevereiro de 2026 como período legado suportado', () => {
      it('retorna a lista estática de compatibilidade sem consultar a API', async () => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'firebase';

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).not.toHaveBeenCalled();
        expect(periods).toEqual([
          {
            year: 2026,
            month: 2,
            period: '2026-02',
            type: 'compatibility',
            isCompatibilityFixture: true,
            metadata: {
              source: 'firebase_static',
              dataset_id: 'ssp_sp_legacy_fixture',
            },
          },
        ]);
      });

      it('retorna a lista estática de compatibilidade quando EXPO_PUBLIC_CRIME_DATA_SOURCE não está definida', async () => {
        delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE;

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).not.toHaveBeenCalled();
        expect(periods[0].period).toBe('2026-02');
        expect(periods[0].type).toBe('compatibility');
        expect(periods[0].isCompatibilityFixture).toBe(true);
      });
    });

    describe('Cenário 23 (Cenário 4 da Etapa 8.1): API indisponível por erro recuperável - fallback para compatibilidade', () => {
      beforeEach(() => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      });

      it('aciona fallback em caso de erro de rede (network)', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'network', message: 'API unreachable' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
        expect(periods[0].type).toBe('compatibility');
      });

      it('aciona fallback em caso de timeout', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'timeout', message: 'Timeout' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
      });

      it('aciona fallback em caso de HTTP 404', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'http', status: 404, message: 'Endpoint não encontrado' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
      });

      it('aciona fallback em caso de HTTP 429 (rate limit)', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'http', status: 429, message: 'Too Many Requests' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
      });

      it('aciona fallback em caso de HTTP 500 (server error)', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'http', status: 500, message: 'Internal Server Error' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
      });

      it('aciona fallback em caso de invalid_response (payload corrompido)', async () => {
        getPeriodsMock.mockRejectedValueOnce(
          new ApiError({ kind: 'invalid_response', message: 'Corrupted payload' })
        );

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual(service.STATIC_COMPATIBILITY_PERIODS);
      });
    });

    describe('Cenário 24 (Cenário 5 da Etapa 8.1): Erros não recuperáveis - propagam erro sem fallback', () => {
      beforeEach(() => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      });

      it('não executa fallback em caso de cancelamento (aborted)', async () => {
        const abortError = new ApiError({ kind: 'aborted', message: 'Request aborted' });
        getPeriodsMock.mockRejectedValueOnce(abortError);

        const service = getService();
        await expect(service.fetchAvailablePeriods()).rejects.toThrow(abortError);
      });

      it('não executa fallback em caso de HTTP 401/403', async () => {
        const authError = new ApiError({ kind: 'http', status: 401, message: 'Unauthorized' });
        getPeriodsMock.mockRejectedValueOnce(authError);

        const service = getService();
        await expect(service.fetchAvailablePeriods()).rejects.toThrow(authError);

        const forbiddenError = new ApiError({ kind: 'http', status: 403, message: 'Forbidden' });
        getPeriodsMock.mockRejectedValueOnce(forbiddenError);

        await expect(service.fetchAvailablePeriods()).rejects.toThrow(forbiddenError);
      });

      it('não executa fallback em caso de HTTP 400/422', async () => {
        const badReqError = new ApiError({ kind: 'http', status: 400, message: 'Bad Request' });
        getPeriodsMock.mockRejectedValueOnce(badReqError);

        const service = getService();
        await expect(service.fetchAvailablePeriods()).rejects.toThrow(badReqError);

        const unprocessableError = new ApiError({ kind: 'http', status: 422, message: 'Unprocessable' });
        getPeriodsMock.mockRejectedValueOnce(unprocessableError);

        await expect(service.fetchAvailablePeriods()).rejects.toThrow(unprocessableError);
      });

      it('não executa fallback em caso de erro de configuração', async () => {
        const configError = new Error('URL da API não definida');
        getPeriodsMock.mockRejectedValueOnce(configError);

        const service = getService();
        await expect(service.fetchAvailablePeriods()).rejects.toThrow(configError);
      });
    });

    describe('Cenário 25 (Cenário 6 da Etapa 8.1): Resposta válida vazia - retorna lista vazia', () => {
      it('preserva array vazio sem acionar fallback para fevereiro', async () => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
        getPeriodsMock.mockResolvedValueOnce({
          data: [],
          meta: { dataset_id: 'ssp_sp_criminal_statistics' },
        });

        const service = getService();
        const periods = await service.fetchAvailablePeriods();

        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
        expect(periods).toEqual([]);
        expect(periods.length).toBe(0);
      });
    });

    describe('Cenário 26 (Cenário 7 da Etapa 8.1): Cache e deduplicação de requisições simultâneas', () => {
      beforeEach(() => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      });

      it('chamadas simultâneas não duplicam requisições (deduplicação via Promise em voo)', async () => {
        getPeriodsMock.mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(mockApiResponse as any), 20);
            })
        );

        const service = getService();

        const [res1, res2, res3] = await Promise.all([
          service.fetchAvailablePeriods(),
          service.fetchAvailablePeriods(),
          service.fetchAvailablePeriods(),
        ]);

        expect(res1).toEqual(res2);
        expect(res2).toEqual(res3);
        expect(getPeriodsMock).toHaveBeenCalledTimes(1);
      });

      it('chamadas subsequentes reutilizam o cache quando forceRefresh = false', async () => {
        getPeriodsMock.mockResolvedValue(mockApiResponse as any);

        const service = getService();

        // 1ª chamada: busca via API
        const res1 = await service.fetchAvailablePeriods();
        expect(res1.length).toBe(1);
        expect(getPeriodsMock).toHaveBeenCalledTimes(1);

        // 2ª chamada: deve vir do cache
        const res2 = await service.fetchAvailablePeriods();
        expect(res2).toEqual(res1);
        expect(getPeriodsMock).toHaveBeenCalledTimes(1);

        // 3ª chamada com forceRefresh = true: deve disparar nova requisição
        const res3 = await service.fetchAvailablePeriods(true);
        expect(res3).toEqual(res1);
        expect(getPeriodsMock).toHaveBeenCalledTimes(2);
      });
    });

    describe('Cenário 27 (Cenário 8 da Etapa 8.1): Regressão - fetchAvailableHistory() continua funcionando e utilizando 02/2026', () => {
      it('fetchAvailableHistory() continua buscando dados de 2/2026 sem alteração de comportamento', async () => {
        delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE;
        (global as any).fetch = jest.fn<any>().mockResolvedValue(mockFetchResponse(200, mockCrimeData));

        const service = getService();
        const history = await service.fetchAvailableHistory();

        expect(history.length).toBe(1);
        expect(history[0].year).toBe(2026);
        expect(history[0].month).toBe(2);
        expect(history[0].data).toEqual(mockCrimeData);
      });
    });

    describe('fetchSelectablePeriods() (Etapa 8.4A)', () => {
      beforeEach(() => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'api';
        process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://localhost:8000';
      });

      it('Cenário 1: API saudável retorna julho ativo e fevereiro de compatibilidade ordenados decrescente', async () => {
        getPeriodsMock.mockResolvedValue({
          data: [
            {
              year: 2026,
              month: 7,
              period: '2026-07',
              type: 'active',
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

        const service = getService();
        const periods = await service.fetchSelectablePeriods();

        expect(periods.length).toBe(2);
        expect(periods[0].period).toBe('2026-07');
        expect(periods[0].type).toBe('active');
        expect(periods[0].isCompatibilityFixture).toBe(false);

        expect(periods[1].period).toBe('2026-02');
        expect(periods[1].type).toBe('compatibility');
        expect(periods[1].isCompatibilityFixture).toBe(true);
      });

      it('Cenário 2: Firebase disponibiliza apenas períodos de compatibilidade (fevereiro/2026)', async () => {
        process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'firebase';

        const service = getService();
        const periods = await service.fetchSelectablePeriods();

        expect(periods.length).toBe(1);
        expect(periods[0].period).toBe('2026-02');
        expect(periods[0].type).toBe('compatibility');
        expect(getPeriodsMock).not.toHaveBeenCalled();
      });

      it('Cenário 3: API indisponível disponibiliza fevereiro por compatibilidade', async () => {
        getPeriodsMock.mockRejectedValue(
          new ApiError({ kind: 'network', message: 'API offline' })
        );

        const service = getService();
        const periods = await service.fetchSelectablePeriods();

        expect(periods.length).toBe(1);
        expect(periods[0].period).toBe('2026-02');
        expect(periods[0].type).toBe('compatibility');
      });

      it('Cenário 4: Catálogo ativo vazio não impede a seleção do período de compatibilidade', async () => {
        getPeriodsMock.mockResolvedValue({
          data: [],
          meta: {
            total_active_periods: 0,
            latest_active_period: null,
            generated_at: '2026-11-02T10:00:00Z',
          },
        } as any);

        const service = getService();
        const periods = await service.fetchSelectablePeriods();

        expect(periods.length).toBe(1);
        expect(periods[0].period).toBe('2026-02');
        expect(periods[0].type).toBe('compatibility');
      });

      it('Cenário 5 e 6: Períodos duplicados não aparecem duas vezes e active prevalece sobre compatibility', async () => {
        getPeriodsMock.mockResolvedValue({
          data: [
            {
              year: 2026,
              month: 2,
              period: '2026-02',
              type: 'active',
              total_occurrences: 90321,
              total_municipalities: 642,
            },
          ],
        } as any);

        const service = getService();
        const periods = await service.fetchSelectablePeriods();

        expect(periods.length).toBe(1);
        expect(periods[0].period).toBe('2026-02');
        expect(periods[0].type).toBe('active');
      });
    });
  });
});
