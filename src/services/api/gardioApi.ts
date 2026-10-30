/**
 * src/services/api/gardioApi.ts
 * Serviço de acesso aos endpoints oficiais da Gardio Intelligence API.
 */

import { getJson, ApiError } from './httpClient';
import {
  isLegacySspPayload,
  isPeriodsResponse,
  isHealthReadyResponse,
} from './guards';
import {
  LegacySspPayload,
  PeriodsResponse,
  HealthReadyResponse,
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
    validate: isHealthReadyResponse,
  });
}

