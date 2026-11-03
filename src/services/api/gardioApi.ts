/**
 * src/services/api/gardioApi.ts
 * Serviço de acesso aos endpoints oficiais da Gardio Intelligence API.
 */

import { getJson, ApiError } from './httpClient';
import {
  isLegacySspPayload,
  isPeriodsResponse,
  isHealthReadyResponse,
  isMunicipalitySummaryResponse,
  isStatewideBenchmarkResponse,
} from './guards';
import {
  LegacySspPayload,
  PeriodsResponse,
  HealthReadyResponse,
  MunicipalitySummaryResponse,
  StatewideBenchmarkResponse,
} from './types';

export interface RequestConfig {
  /**
   * Tempo limite customizado em milissegundos.
   */
  timeoutMs?: number;

  /**
   * Sinal externo de cancelamento.
   */
  signal?: AbortSignal;

  /**
   * URL base customizada (útil para testes unitários ou ambientes isolados).
   */
  baseUrl?: string;

  /**
   * Se falso, desativa o mecanismo de retry.
   */
  retry?: boolean;
}

/**
 * Consulta estatísticas criminais no formato legado da SSP-SP para o período especificado.
 * Padrão confirmado na API: GET /ssp-{month}-{year}.json
 *
 * @param month Mês estatístico (1 a 12).
 * @param year Ano estatístico (ex: 2026).
 * @param config Configurações opcionais de timeout e cancelamento.
 * @returns Payload legado estruturalmente compatível com RawCrimeData.
 */
export async function getLegacyPeriod(
  month: number,
  year: number,
  config?: RequestConfig
): Promise<LegacySspPayload> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ApiError({
      kind: 'invalid_response',
      message: `Mês inválido para consulta do período legado: ${month}. O mês deve ser um número inteiro entre 1 e 12.`,
    });
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError({
      kind: 'invalid_response',
      message: `Ano inválido para consulta do período legado: ${year}. O ano deve ser um número inteiro entre 2000 e 2100.`,
    });
  }

  const path = `/ssp-${month}-${year}.json`;

  return getJson<LegacySspPayload>(path, {
    timeoutMs: config?.timeoutMs,
    signal: config?.signal,
    baseUrl: config?.baseUrl,
    retry: config?.retry,
    validate: isLegacySspPayload,
  });
}

/**
 * Consulta a lista de períodos históricos oficiais catalogados e ativos na API.
 * Endpoint: GET /v1/periods
 *
 * @param config Configurações opcionais de timeout e cancelamento.
 * @returns Envelope com a lista de períodos disponíveis e metadados.
 */
export async function getPeriods(config?: RequestConfig): Promise<PeriodsResponse> {
  return getJson<PeriodsResponse>('/v1/periods', {
    timeoutMs: config?.timeoutMs,
    signal: config?.signal,
    baseUrl: config?.baseUrl,
    retry: config?.retry,
    validate: isPeriodsResponse,
  });
}

/**
 * Verifica a prontidão operacional da API e da conectividade com o banco de dados.
 * Endpoint: GET /health/ready
 *
 * @param config Configurações opcionais de timeout e cancelamento.
 * @returns Status de prontidão do serviço.
 */
export async function getHealth(config?: RequestConfig): Promise<HealthReadyResponse> {
  return getJson<HealthReadyResponse>('/health/ready', {
    timeoutMs: config?.timeoutMs,
    signal: config?.signal,
    baseUrl: config?.baseUrl,
    retry: config?.retry,
    validate: isHealthReadyResponse,
  });
}

/**
 * Consulta o resumo analítico executivo de um município (volume, taxa por 100k, fatias e Top 5 crimes).
 * Endpoint: GET /v1/crime-statistics/summary
 *
 * Regras da API:
 * - municipality é obrigatório (será codificado e normalizado canonicamente pela API).
 * - year e month são opcionais.
 * - Quando ambos são omitidos, a API resolve dinamicamente para o período ativo mais recente (ex: 2026-07).
 * - Quando apenas um entre year ou month é informado, a API rejeita com HTTP 422.
 *
 * @param municipality Nome ou chave SSP do município (ex: "S.PAULO", "São José dos Campos").
 * @param year Ano estatístico opcional (ex: 2026).
 * @param month Mês estatístico opcional (1 a 12).
 * @param config Configurações opcionais de timeout, cancelamento ou baseUrl.
 * @returns Resposta com o resumo executivo e metadados.
 */
export async function getCrimeStatisticsSummary(
  municipality: string,
  year?: number,
  month?: number,
  config?: RequestConfig
): Promise<MunicipalitySummaryResponse> {
  if (!municipality || typeof municipality !== 'string' || municipality.trim().length === 0) {
    throw new ApiError({
      kind: 'invalid_response',
      message: 'Município obrigatório para consulta de estatísticas analíticas.',
    });
  }

  const params: Record<string, string | number | undefined> = {
    municipality: municipality.trim(),
  };

  if (year !== undefined) {
    params.year = year;
  }
  if (month !== undefined) {
    params.month = month;
  }

  return getJson<MunicipalitySummaryResponse>('/v1/crime-statistics/summary', {
    params,
    timeoutMs: config?.timeoutMs,
    signal: config?.signal,
    baseUrl: config?.baseUrl,
    retry: config?.retry,
    validate: isMunicipalitySummaryResponse,
  });
}

/**
 * Consulta o benchmark analítico consolidado do Estado de São Paulo.
 * Endpoint: GET /v1/crime-statistics/benchmark
 *
 * Regras da API:
 * - year e month são opcionais.
 * - Quando ambos são omitidos, a API resolve dinamicamente para o período ativo mais recente (ex: 2026-07).
 * - Quando apenas um entre year ou month é informado, a API rejeita com HTTP 422.
 *
 * @param year Ano estatístico opcional (ex: 2026).
 * @param month Mês estatístico opcional (1 a 12).
 * @param config Configurações opcionais de timeout, cancelamento ou baseUrl.
 * @returns Resposta com o benchmark estadual pré-calculado e metadados.
 */
export async function getCrimeStatisticsBenchmark(
  year?: number,
  month?: number,
  config?: RequestConfig
): Promise<StatewideBenchmarkResponse> {
  const params: Record<string, number | undefined> = {};

  if (year !== undefined) {
    params.year = year;
  }
  if (month !== undefined) {
    params.month = month;
  }

  return getJson<StatewideBenchmarkResponse>('/v1/crime-statistics/benchmark', {
    params,
    timeoutMs: config?.timeoutMs,
    signal: config?.signal,
    baseUrl: config?.baseUrl,
    retry: config?.retry,
    validate: isStatewideBenchmarkResponse,
  });
}
