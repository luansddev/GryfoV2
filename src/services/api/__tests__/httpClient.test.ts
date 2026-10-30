/**
 * src/services/api/__tests__/httpClient.test.ts
 * Testes unitários para o cliente HTTP reutilizável.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import {
  getJson,
  buildUrl,
  ApiError,
  DEFAULT_TIMEOUT_MS,
} from '../httpClient';

describe('src/services/api/httpClient.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    const isStr = typeof body === 'string';
    const textBody = isStr ? body : JSON.stringify(body);
    const lowerHeaders = new Map(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
      headers: {
        get: (h: string) => lowerHeaders.get(h.toLowerCase()) ?? null,
      },
      text: async () => textBody,
      json: async () => (isStr ? JSON.parse(textBody) : body),
    } as unknown as Response;
  }

  describe('Cenário 1: Construção de URL e parâmetros', () => {
    it('monta a URL combinando baseUrl e caminho relativo com parâmetros sanitizados', () => {
      const url = buildUrl(
        '/v1/crime-statistics',
        {
          municipality: 'Campinas',
          year: 2026,
          month: 2,
          include_locations: true,
          ignorar: undefined,
          ignorarNulo: null,
        },
        'http://localhost:8000'
      );

      const parsed = new URL(url);
      expect(parsed.origin).toBe('http://localhost:8000');
      expect(parsed.pathname).toBe('/v1/crime-statistics');
      expect(parsed.searchParams.get('municipality')).toBe('Campinas');
      expect(parsed.searchParams.get('year')).toBe('2026');
      expect(parsed.searchParams.get('month')).toBe('2');
      expect(parsed.searchParams.get('include_locations')).toBe('true');
      expect(parsed.searchParams.has('ignorar')).toBe(false);
      expect(parsed.searchParams.has('ignorarNulo')).toBe(false);
    });

    it('preserva URLs absolutas informadas diretamente no caminho', () => {
      const url = buildUrl(
        'https://external.service.com/data',
        { q: 'test' },
        'http://localhost:8000'
      );
      expect(url).toBe('https://external.service.com/data?q=test');
    });
  });

  describe('Cenário 2: Resposta JSON válida (HTTP 200)', () => {
    it('retorna os dados desserializados quando o status é 200 e o JSON é válido', async () => {
      const payload = { status: 'ready', database: 'connected', service: 'gardio-api' };
      (global as any).fetch = jest.fn<any>().mockResolvedValue(mockResponse(200, payload));

      const result = await getJson<typeof payload>('/health/ready', {
        baseUrl: 'http://localhost:8000',
      });

      expect(result).toEqual(payload);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cenário 3: HTTP 404 sem retry', () => {
    it('lança ApiError com status 404 e não efetua novas tentativas', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(404, { detail: 'Período não publicado.' })
      );

      await expect(
        getJson('/v1/periods/nao-existe', { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 404,
        message: 'Período não publicado.',
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cenário 4: HTTP 500 com retry limitado', () => {
    it('tenta novamente após erro 500 e obtém sucesso na 2ª tentativa', async () => {
      (global as any).fetch = jest
        .fn<any>()
        .mockResolvedValueOnce(mockResponse(500, 'Internal Server Error'))
        .mockResolvedValueOnce(mockResponse(200, { ok: true }));

      const result = await getJson<{ ok: boolean }>('/dados', {
        baseUrl: 'http://localhost:8000',
        backoffMs: 10,
      });

      expect(result).toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('falha após atingir o limite de 2 tentativas em caso de erro 500 persistente', async () => {
      (global as any).fetch = jest
        .fn<any>()
        .mockResolvedValue(mockResponse(500, { detail: 'Database error' }));

      await expect(
        getJson('/dados', { baseUrl: 'http://localhost:8000', backoffMs: 10 })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 500,
        message: 'Database error',
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cenário 5: HTTP 429 e Retry-After', () => {
    it('interpreta Retry-After e repete a chamada com sucesso', async () => {
      (global as any).fetch = jest
        .fn<any>()
        .mockResolvedValueOnce(
          mockResponse(
            429,
            { error: { code: 'rate_limit', message: 'Limite atingido' } },
            { 'Retry-After': '0' }
          )
        )
        .mockResolvedValueOnce(mockResponse(200, { success: true }));

      const result = await getJson<{ success: true }>('/dados', {
        baseUrl: 'http://localhost:8000',
        backoffMs: 10,
      });

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('aborta a repetição imediatamente se Retry-After for excessivo (> 5s)', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(
          429,
          { error: { code: 'rate_limit', message: 'Muitas requisições' } },
          { 'Retry-After': '60' }
        )
      );

      await expect(
        getJson('/dados', { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 429,
        retryAfter: 60,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cenário 6: Timeout', () => {
    it('lança ApiError do tipo timeout quando a requisição excede o tempo limite', async () => {
      (global as any).fetch = jest.fn<any>().mockImplementation(
        (_url: any, init: any) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      await expect(
        getJson('/timeout', { baseUrl: 'http://localhost:8000', timeoutMs: 50 })
      ).rejects.toMatchObject({
        kind: 'timeout',
        message: expect.stringContaining('tempo limite de 50ms'),
      });
    });
  });

  describe('Cenário 7: Cancelamento externo', () => {
    it('aborta a requisição sem efetuar retry quando o sinal do consumidor é cancelado', async () => {
      const controller = new AbortController();

      (global as any).fetch = jest.fn<any>().mockImplementation((_url: any, init: any) => {
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted by consumer');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const promise = getJson('/cancelar', {
        baseUrl: 'http://localhost:8000',
        signal: controller.signal,
      });

      controller.abort();

      await expect(promise).rejects.toMatchObject({
        kind: 'aborted',
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('rejeita imediatamente se o sinal já estiver cancelado antes da chamada', async () => {
      const controller = new AbortController();
      controller.abort();

      (global as any).fetch = jest.fn<any>();

      await expect(
        getJson('/ja-cancelado', {
          baseUrl: 'http://localhost:8000',
          signal: controller.signal,
        })
      ).rejects.toMatchObject({
        kind: 'aborted',
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cenário 8: Falha de rede', () => {
    it('classifica TypeError de conexão como erro de rede e tenta novamente uma vez', async () => {
      (global as any).fetch = jest
        .fn<any>()
        .mockRejectedValue(new TypeError('Network request failed'));

      await expect(
        getJson('/offline', { baseUrl: 'http://localhost:8000', backoffMs: 10 })
      ).rejects.toMatchObject({
        kind: 'network',
        message: 'Network request failed',
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cenário 9: JSON malformado', () => {
    it('lança ApiError do tipo invalid_response se o corpo não for JSON parseável', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, '{corpo_invalido_sem_fechamento')
      );

      await expect(
        getJson('/bad-json', { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('não pôde ser interpretada como JSON'),
      });
    });
  });

  describe('Cenário 10: JSON estruturalmente inválido', () => {
    it('lança invalid_response quando a resposta falha na validação do guard', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(200, { formato: 'desconhecido' })
      );

      const guard = (data: unknown): data is { status: string } =>
        Boolean(data && typeof data === 'object' && 'status' in data);

      await expect(
        getJson('/validar', { baseUrl: 'http://localhost:8000', validate: guard })
      ).rejects.toMatchObject({
        kind: 'invalid_response',
        message: expect.stringContaining('incompatível com o contrato esperado'),
      });
    });
  });

  describe('Cenário 11: Extração de erros do FastAPI', () => {
    it('extrai mensagens detalhadas de detail em respostas de erro', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(422, {
          detail: 'Formato de período inválido: utilize YYYY-MM.',
        })
      );

      await expect(
        getJson('/v1/periods/bad', { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 422,
        message: 'Formato de período inválido: utilize YYYY-MM.',
        detail: 'Formato de período inválido: utilize YYYY-MM.',
      });
    });
  });

  describe('Cenário 12: Extração de respostas de rate limit', () => {
    it('extrai code e message de envelope error em respostas 429', async () => {
      (global as any).fetch = jest.fn<any>().mockResolvedValue(
        mockResponse(
          429,
          {
            error: {
              code: 'rate_limit_exceeded',
              message: 'Limite de 120 requisições por minuto excedido.',
            },
          },
          { 'Retry-After': '10' }
        )
      );

      await expect(
        getJson('/v1/periods', { baseUrl: 'http://localhost:8000' })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 429,
        message: 'Limite de 120 requisições por minuto excedido.',
        detail: {
          code: 'rate_limit_exceeded',
          message: 'Limite de 120 requisições por minuto excedido.',
        },
        retryAfter: 10,
      });
    });
  });
});
