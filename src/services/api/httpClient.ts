/**
 * src/services/api/httpClient.ts
 * Cliente HTTP reutilizável com timeout, cancelamento externo, validação e retry.
 */

import { getApiBaseUrl } from '../../config/api';

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'invalid_response' | 'aborted';

export interface ApiErrorParams {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  detail?: unknown;
  retryAfter?: number;
  cause?: unknown;
}

/**
 * Erro padronizado para falhas de comunicação com a Gardio Intelligence API.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly detail?: unknown;
  readonly retryAfter?: number;
  readonly cause?: unknown;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status;
    this.detail = params.detail;
    this.retryAfter = params.retryAfter;
    this.cause = params.cause;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface GetJsonOptions<T> {
  /**
   * Parâmetros de consulta (query string).
   */
  params?: Record<string, string | number | boolean | undefined | null>;

  /**
   * Tempo limite em milissegundos. Padrão: 10000 (10 segundos).
   */
  timeoutMs?: number;

  /**
   * Sinal externo de cancelamento (AbortSignal).
   */
  signal?: AbortSignal;

  /**
   * Função validadora da estrutura da resposta.
   * Se retornar falso, lança ApiError do tipo 'invalid_response'.
   */
  validate?: (data: unknown) => data is T;

  /**
   * Se falso, desativa o mecanismo de retry.
   */
  retry?: boolean;

  /**
   * Número máximo de tentativas totais (padrão: 2 = 1 inicial + 1 retry).
   */
  maxAttempts?: number;

  /**
   * Backoff base em milissegundos entre tentativas (padrão: 300ms).
   */
  backoffMs?: number;

  /**
   * Sobrescreve a URL base da API (útil para testes unitários ou endpoints isolados).
   */
  baseUrl?: string;
}

export const DEFAULT_TIMEOUT_MS = 10000;
export const DEFAULT_MAX_ATTEMPTS = 2;
export const DEFAULT_INITIAL_BACKOFF_MS = 300;
export const MAX_ALLOWED_RETRY_AFTER_MS = 5000;

/**
 * Constrói a URL completa a partir de um caminho relativo ou absoluto e de parâmetros opcionais.
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
  baseUrl?: string
): string {
  let fullUrl: string;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    fullUrl = path;
  } else {
    const resolvedBase = (baseUrl ?? getApiBaseUrl()).replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    fullUrl = `${resolvedBase}${cleanPath}`;
  }

  const url = new URL(fullUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * Aguarda por um período em milissegundos com suporte a cancelamento por AbortSignal.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ApiError({
          kind: 'aborted',
          message: 'A requisição foi cancelada pelo consumidor.',
        })
      );
      return;
    }

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      reject(
        new ApiError({
          kind: 'aborted',
          message: 'A requisição foi cancelada pelo consumidor.',
        })
      );
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Determina se um erro específico qualifica para uma nova tentativa automática (retry).
 */
function isRetryableError(error: ApiError): boolean {
  if (error.kind === 'network') {
    return true;
  }
  if (error.kind === 'http' && error.status !== undefined) {
    if (error.status >= 500 && error.status <= 599) {
      return true;
    }
    if (error.status === 429) {
      return true;
    }
  }
  return false;
}

/**
 * Executa uma única tentativa de requisição HTTP GET com timeout e tratamento de erros.
 */
async function executeSingleAttempt<T>(
  url: string,
  options: GetJsonOptions<T>
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const externalSignal = options.signal;

  if (externalSignal?.aborted) {
    throw new ApiError({
      kind: 'aborted',
      message: 'A requisição foi cancelada pelo consumidor.',
    });
  }

  const controller = new AbortController();
  let isTimeout = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (isTimeout) {
      throw new ApiError({
        kind: 'timeout',
        message: `A requisição excedeu o tempo limite de ${timeoutMs}ms.`,
        cause: err,
      });
    }

    if (externalSignal?.aborted) {
      throw new ApiError({
        kind: 'aborted',
        message: 'A requisição foi cancelada pelo consumidor.',
        cause: err,
      });
    }

    if (err?.name === 'AbortError') {
      throw new ApiError({
        kind: 'aborted',
        message: 'A requisição foi abortada.',
        cause: err,
      });
    }

    throw new ApiError({
      kind: 'network',
      message: err?.message || 'Falha de conexão com o servidor.',
      cause: err,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  // Tratamento de respostas de erro HTTP (!response.ok)
  if (!response.ok) {
    const status = response.status;
    let retryAfter: number | undefined;

    const retryHeader = response.headers?.get ? response.headers.get('Retry-After') : undefined;
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        retryAfter = parsed;
      }
    }

    let responseJson: any = null;
    let rawText = '';
    try {
      rawText = await response.text();
      if (rawText) {
        responseJson = JSON.parse(rawText);
      }
    } catch {
      // Corpo não é JSON válido, mantém rawText
    }

    let detail: unknown = undefined;
    let message = `Erro HTTP ${status}: ${response.statusText || 'Falha na requisição'}`;

    if (responseJson && typeof responseJson === 'object') {
      if ('detail' in responseJson) {
        detail = responseJson.detail;
        if (typeof detail === 'string') {
          message = detail;
        } else {
          message = JSON.stringify(detail);
        }
      } else if (responseJson.error && typeof responseJson.error === 'object') {
        detail = responseJson.error;
        if (typeof responseJson.error.message === 'string') {
          message = responseJson.error.message;
        }
      }
    } else if (rawText) {
      detail = rawText;
      if (rawText.length < 200) {
        message = rawText;
      }
    }

    throw new ApiError({
      kind: 'http',
      status,
      message,
      detail,
      retryAfter,
    });
  }

  // Tratamento de respostas bem-sucedidas (HTTP 200)
  let rawJson: unknown;
  try {
    const text = await response.text();
    rawJson = JSON.parse(text);
  } catch (parseErr: any) {
    throw new ApiError({
      kind: 'invalid_response',
      status: response.status,
      message: 'A resposta do servidor não pôde ser interpretada como JSON.',
      detail: parseErr?.message,
      cause: parseErr,
    });
  }

  if (options.validate) {
    if (!options.validate(rawJson)) {
      throw new ApiError({
        kind: 'invalid_response',
        status: response.status,
        message: 'A resposta do servidor possui estrutura incompatível com o contrato esperado.',
        detail: rawJson,
      });
    }
  }

  return rawJson as T;
}

/**
 * Executa uma requisição HTTP GET retornando JSON com suporte a timeout,
 * cancelamento, validação estrutural e retry limitado.
 */
export async function getJson<T>(
  path: string,
  options: GetJsonOptions<T> = {}
): Promise<T> {
  const url = buildUrl(path, options.params, options.baseUrl);
  const maxAttempts =
    options.retry === false ? 1 : (options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const initialBackoffMs = options.backoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await executeSingleAttempt<T>(url, options);
    } catch (err: unknown) {
      lastError = err;

      if (!(err instanceof ApiError)) {
        throw err;
      }

      // Não repete requisições explicitamente canceladas
      if (err.kind === 'aborted' || options.signal?.aborted) {
        throw err;
      }

      // Última tentativa: propaga o erro imediatamente
      if (attempt >= maxAttempts) {
        throw err;
      }

      // Verifica se o erro qualifica para retry (rede, 5xx, 429)
      if (!isRetryableError(err)) {
        throw err;
      }

      // Calcula o intervalo de espera
      let delayMs = initialBackoffMs * Math.pow(2, attempt - 1);

      if (err.status === 429 && typeof err.retryAfter === 'number') {
        const retryAfterMs = err.retryAfter * 1000;
        if (retryAfterMs > MAX_ALLOWED_RETRY_AFTER_MS) {
          // Retry-After excessivo: não bloqueia a aplicação, falha imediatamente
          throw err;
        }
        delayMs = Math.max(delayMs, retryAfterMs);
      }

      await delay(delayMs, options.signal);
    }
  }

  throw lastError;
}

