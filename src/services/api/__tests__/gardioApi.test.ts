/**
 * src/services/api/__tests__/gardioApi.test.ts
 * Testes unitários para o serviço de consumo dos endpoints da Gardio Intelligence API.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import {
  getLegacyPeriod,
  getPeriods,
  getHealth,
  getCrimeStatisticsSummary,
  getCrimeStatisticsBenchmark,
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
      statusText:
        status === 200
          ? 'OK'
          : status === 404
          ? 'Not Found'
          : status === 422
          ? 'Unprocessable Entity'
          : 'Error',
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

  /* ====================================================================== */
  /* Novos Clientes: getCrimeStatisticsSummary e getCrimeStatisticsBenchmark */
  /* ====================================================================== */

  describe('getCrimeStatisticsSummary', () => {
    const mockSummaryPayload = {
      data: {
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
      },
      meta: {
        period: '2026-07',
        dataset_id: 'ssp_sp_criminal_statistics',
      },
    };

    it('requisita com sucesso e aceita resposta válida', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockSummaryPayload));

      const result = await getCrimeStatisticsSummary('SAO PAULO', 2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      expect(result).toEqual(mockSummaryPayload);
    });

    it('codifica corretamente município com acentos, espaços e caracteres especiais', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockSummaryPayload));

      await getCrimeStatisticsSummary('São José dos Campos', undefined, undefined, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.pathname).toBe('/v1/crime-statistics/summary');
      expect(parsedUrl.searchParams.get('municipality')).toBe('São José dos Campos');
      expect(calledUrl).toContain('municipality=S%C3%A3o+Jos%C3%A9+dos+Campos');
    });

    it('envia year e month quando ambos são informados', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockSummaryPayload));

      await getCrimeStatisticsSummary('Campinas', 2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('municipality')).toBe('Campinas');
      expect(parsedUrl.searchParams.get('year')).toBe('2026');
      expect(parsedUrl.searchParams.get('month')).toBe('7');
    });

    it('omite year e month quando ambos não são informados (para resolver período ativo padrão)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockSummaryPayload));

      await getCrimeStatisticsSummary('Campinas', undefined, undefined, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('municipality')).toBe('Campinas');
      expect(parsedUrl.searchParams.has('year')).toBe(false);
      expect(parsedUrl.searchParams.has('month')).toBe(false);
    });

    it('envia ano isolado quando mês não for informado, permitindo que a API valide com HTTP 422', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockSummaryPayload));

      await getCrimeStatisticsSummary('Campinas', 2026, undefined, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.searchParams.get('year')).toBe('2026');
      expect(parsedUrl.searchParams.has('month')).toBe(false);
    });

    it('rejeita município vazio antes de disparar requisição', async () => {
      (global as any).fetch = jest.fn<any>();

      await expect(getCrimeStatisticsSummary('')).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('Município obrigatório'),
      });

      await expect(getCrimeStatisticsSummary('   ')).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('Município obrigatório'),
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('aceita campos nullable quando nulos (population_2022: null, rate_per_100k: null)', async () => {
      const payloadNulls = {
        data: {
          ...mockSummaryPayload.data,
          population_2022: null,
          rate_per_100k: null,
        },
        meta: mockSummaryPayload.meta,
      };
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, payloadNulls));

      const result = await getCrimeStatisticsSummary('SAO PAULO', 2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      expect(result.data.population_2022).toBeNull();
      expect(result.data.rate_per_100k).toBeNull();
    });

    it('lança invalid_response quando o payload retornado for incompatível', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, { data: { municipality_key: 'INVALIDO' } })
      );

      await expect(
        getCrimeStatisticsSummary('SAO PAULO', 2026, 7, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
      });
    });

    it('preserva erro HTTP 404 (município ou período não encontrado)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(404, { detail: "Não foram encontradas estatísticas para o município 'XYZ'." })
      );

      await expect(
        getCrimeStatisticsSummary('XYZ', 2026, 7, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 404,
        message: expect.stringContaining('XYZ'),
      });
    });

    it('preserva erro HTTP 422 (parâmetros conflitantes ou incompletos)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(422, {
          detail: "Os parâmetros 'year' e 'month' devem ser informados juntos.",
        })
      );

      await expect(
        getCrimeStatisticsSummary('SAO PAULO', 2026, undefined, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 422,
        message: expect.stringContaining('informados juntos'),
      });
    });

    it('preserva erros de rede (network)', async () => {
      (global as any).fetch = jest.fn<any>().mockRejectedValue(new Error('Falha de conexão DNS'));

      await expect(
        getCrimeStatisticsSummary('SAO PAULO', 2026, 7, {
          baseUrl: 'http://localhost:8000',
          retry: false,
        })
      ).rejects.toMatchObject({
        kind: 'network',
        message: expect.stringContaining('Falha de conexão DNS'),
      });
    });
  });

  describe('getCrimeStatisticsBenchmark', () => {
    const mockBenchmarkPayload = {
      data: {
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
      },
      meta: {
        period: '2026-07',
        dataset_id: 'ssp_sp_criminal_statistics',
      },
    };

    it('requisita com sucesso e aceita resposta válida', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockBenchmarkPayload));

      const result = await getCrimeStatisticsBenchmark(2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      expect(result).toEqual(mockBenchmarkPayload);
    });

    it('envia year e month quando ambos são informados', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockBenchmarkPayload));

      await getCrimeStatisticsBenchmark(2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.pathname).toBe('/v1/crime-statistics/benchmark');
      expect(parsedUrl.searchParams.get('year')).toBe('2026');
      expect(parsedUrl.searchParams.get('month')).toBe('7');
    });

    it('omite year e month quando ambos não são informados (para resolver período ativo padrão)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockBenchmarkPayload));

      await getCrimeStatisticsBenchmark(undefined, undefined, {
        baseUrl: 'http://localhost:8000',
      });

      const calledUrl = (global.fetch as any).mock.calls[0][0];
      const parsedUrl = new URL(calledUrl);

      expect(parsedUrl.pathname).toBe('/v1/crime-statistics/benchmark');
      expect(parsedUrl.searchParams.has('year')).toBe(false);
      expect(parsedUrl.searchParams.has('month')).toBe(false);
    });

    it('aceita campos nullable de taxas e cobertura (rate_per_100k: null com covered_rate_per_100k preenchido)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, mockBenchmarkPayload));

      const result = await getCrimeStatisticsBenchmark(2026, 7, {
        baseUrl: 'http://localhost:8000',
      });

      expect(result.data.rate_per_100k).toBeNull();
      expect(result.data.covered_rate_per_100k).toBe(203.38);
      expect(result.data.covered_municipalities).toBe(626);
    });

    it('lança invalid_response quando o payload do benchmark for inválido', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, { data: { state: 'RJ' } })
      );

      await expect(
        getCrimeStatisticsBenchmark(2026, 7, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
      });
    });

    it('preserva erro HTTP 404 (período não disponível)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(404, { detail: 'Dados do benchmark estadual indisponíveis para o período.' })
      );

      await expect(
        getCrimeStatisticsBenchmark(2026, 2, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 404,
        message: expect.stringContaining('indisponíveis'),
      });
    });

    it('preserva erro HTTP 422 (apenas ano informado)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(422, {
          detail: "Os parâmetros 'year' e 'month' devem ser informados juntos.",
        })
      );

      await expect(
        getCrimeStatisticsBenchmark(2026, undefined, { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 422,
        message: expect.stringContaining('informados juntos'),
      });
    });

    it('preserva erros de rede (network)', async () => {
      (global as any).fetch = jest.fn<any>().mockRejectedValue(new Error('Connection reset by peer'));

      await expect(
        getCrimeStatisticsBenchmark(2026, 7, {
          baseUrl: 'http://localhost:8000',
          retry: false,
        })
      ).rejects.toMatchObject({
        kind: 'network',
        message: expect.stringContaining('Connection reset by peer'),
      });
    });
  });
});
