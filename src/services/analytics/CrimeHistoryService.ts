import { apiConfig, isDevelopmentEnvironment } from '../../config/api';
import { getLegacyPeriod, getPeriods } from '../api/gardioApi';
import { ApiError } from '../api/httpClient';
import { ResponseMetadata } from '../api/types';

export interface RawCrimeData {
  [city: string]: {
    [crimeType: string]: {
      quantidade: number;
      localizacoes: { latitude: number; longitude: number }[];
    };
  };
}

/**
 * Categoria arquitetural de um período estatístico criminal no Gardio.
 * - 'active': período oficial ativo publicado pela API (ex: 07/2026).
 * - 'compatibility': período legado/fixture de compatibilidade (ex: 02/2026).
 * - 'unknown': período cuja classificação ainda não foi confirmada pelo catálogo oficial ou está indisponível.
 */
export type CrimePeriodType = 'active' | 'compatibility' | 'unknown';

/**
 * Informações estruturadas de um período estatístico criminal disponível.
 */
export interface CrimePeriodInfo {
  year: number;
  month: number;
  period: string; // Padrão "YYYY-MM" (ex: "2026-07" ou "2026-02")
  type: CrimePeriodType;
  isCompatibilityFixture: boolean;
  total_occurrences?: number;
  total_municipalities?: number;
  metadata?: ResponseMetadata;
}

/**
 * Lista estática de períodos legados de compatibilidade suportados pelo Firebase Hosting
 * e utilizados como fallback contingencial em caso de indisponibilidade da Gardio API.
 * Atualmente contempla exclusivamente fevereiro de 2026 (fixture de compatibilidade).
 */
export const STATIC_COMPATIBILITY_PERIODS: CrimePeriodInfo[] = [
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
];

/**
 * Determina se um erro retornado pela Gardio API é uma falha transitória/recuperável
 * que justifica o acionamento de contingência (fallback) para o Firebase Hosting.
 */
function isRecoverableApiError(error: unknown): boolean {
  const isApiError =
    error instanceof ApiError ||
    (error instanceof Error && error.name === 'ApiError' && 'kind' in error);

  if (isApiError) {
    const apiErr = error as ApiError;

    // Cancelamento explícito nunca deve acionar fallback
    if (apiErr.kind === 'aborted') {
      return false;
    }

    // Falhas de rede, timeout e respostas com contrato corrompido são recuperáveis
    if (
      apiErr.kind === 'network' ||
      apiErr.kind === 'timeout' ||
      apiErr.kind === 'invalid_response'
    ) {
      return true;
    }

    // Erros HTTP: 404 (período não publicado na API), 429 (rate limit) e 5xx (falhas de servidor)
    if (apiErr.kind === 'http' && typeof apiErr.status === 'number') {
      if (apiErr.status === 404 || apiErr.status === 429) {
        return true;
      }
      if (apiErr.status >= 500 && apiErr.status <= 599) {
        return true;
      }
      // 400, 401, 403, 422 e outros 4xx não são recuperáveis
      return false;
    }
  }

  // Erros de configuração (ex: URL ausente), de código ou desconhecidos não disparam fallback
  return false;
}

/**
 * Busca os dados criminais históricos diretamente no Firebase Hosting (implementação original).
 */
const fetchFromFirebase = async (month: number, year: number): Promise<RawCrimeData | null> => {
  try {
    const res = await fetch(`https://gryfocorp.web.app/ssp-${month}-${year}.json`);
    if (!res.ok) {
      if (res.status === 404) return null; // Period not available yet
      throw new Error(`Failed to fetch data for ${month}/${year}`);
    }
    const json = await res.json();
    return json as RawCrimeData;
  } catch (error) {
    console.error(`Error fetching crime data for ${month}/${year}:`, error);
    throw error;
  }
};

export const fetchCrimeDataForPeriod = async (month: number, year: number): Promise<RawCrimeData | null> => {
  if (apiConfig.source === 'api') {
    try {
      const data = await getLegacyPeriod(month, year);
      return data as RawCrimeData;
    } catch (apiError: unknown) {
      if (isRecoverableApiError(apiError)) {
        if (isDevelopmentEnvironment()) {
          console.warn(
            `[CrimeHistoryService] Falha recuperável na Gardio API para ${month}/${year}. ` +
            `Acionando fallback para o Firebase Hosting. Detalhes: ${
              apiError instanceof Error ? apiError.message : String(apiError)
            }`
          );
        }
        return fetchFromFirebase(month, year);
      }
      throw apiError;
    }
  }

  return fetchFromFirebase(month, year);
};

const CACHE: Record<string, RawCrimeData | undefined> = {};
const PENDING_REQUESTS: Record<string, Promise<RawCrimeData | null> | undefined> = {};

export const getCrimeData = async (month: number, year: number, forceRefresh: boolean = false): Promise<RawCrimeData | null> => {
  const cacheKey = `${month}-${year}`;
  
  if (!forceRefresh) {
    if (CACHE[cacheKey]) {
      return CACHE[cacheKey];
    }

    if (PENDING_REQUESTS[cacheKey]) {
      return PENDING_REQUESTS[cacheKey];
    }
  }

  const request = fetchCrimeDataForPeriod(month, year).then(data => {
    if (data) {
      CACHE[cacheKey] = data;
    }
    delete PENDING_REQUESTS[cacheKey];
    return data;
  }).catch(error => {
    delete PENDING_REQUESTS[cacheKey];
    throw error;
  });

  PENDING_REQUESTS[cacheKey] = request;
  return request;
};

// V1 implementation: We only know of 2/2026 right now.
export const fetchAvailableHistory = async (forceRefresh: boolean = false): Promise<{ year: number, month: number, data: RawCrimeData }[]> => {
  const history = [];
  
  // Try fetching the known data
  const dataFeb2026 = await getCrimeData(2, 2026, forceRefresh);
  if (dataFeb2026) {
    history.push({ year: 2026, month: 2, data: dataFeb2026 });
  }

  // Future-proofing: We could try to probe other months if they were deployed, 
  // but for V1 we just use the known available period to avoid excessive 404s.
  // If we had an endpoint that lists available periods, we'd call it here.

  return history;
};

let PERIODS_CACHE: CrimePeriodInfo[] | null = null;
let PENDING_PERIODS_REQUEST: Promise<CrimePeriodInfo[]> | null = null;

/**
 * Limpa o cache em memória de períodos disponíveis (útil em testes e transições de ambiente).
 */
export const clearPeriodsCache = (): void => {
  PERIODS_CACHE = null;
  PENDING_PERIODS_REQUEST = null;
};

/**
 * Consulta os períodos criminais disponíveis para o aplicativo.
 *
 * Regras arquiteturais:
 * 1. Quando source === 'api':
 *    - Invoca getPeriods() (GET /v1/periods).
 *    - Retorna exclusivamente os períodos ativos oficiais informados pela API (ex: 07/2026).
 *    - Preserva contagens (total_occurrences, total_municipalities) e metadados retornados.
 *    - Uma resposta bem-sucedida com lista vazia ([]), permanece vazia ([]).
 *    - Em caso de falha recuperável (network, timeout, 404, 429, 5xx, invalid_response),
 *      aciona contingência e retorna a lista estática de compatibilidade (02/2026).
 *    - Erros não recuperáveis (aborted, 401, 403, 400, 422, config) são lançados sem fallback.
 * 2. Quando source === 'firebase':
 *    - Retorna a lista estática de compatibilidade suportada pelo Firebase (02/2026).
 * 3. Cache e deduplicação:
 *    - Requisições simultâneas compartilham a mesma Promise em voo.
 *    - Respostas bem-sucedidas são armazenadas em cache em memória durante a sessão.
 *    - forceRefresh = true ignora o cache e força nova consulta.
 *
 * @param forceRefresh Se true, ignora o cache e força nova requisição.
 */
export const fetchAvailablePeriods = async (
  forceRefresh: boolean = false
): Promise<CrimePeriodInfo[]> => {
  if (!forceRefresh) {
    if (PERIODS_CACHE !== null) {
      return PERIODS_CACHE;
    }

    if (PENDING_PERIODS_REQUEST !== null) {
      return PENDING_PERIODS_REQUEST;
    }
  }

  const request = (async (): Promise<CrimePeriodInfo[]> => {
    if (apiConfig.source === 'api') {
      try {
        const response = await getPeriods();
        const items = response.data || [];
        const activePeriods: CrimePeriodInfo[] = items.map((item) => ({
          year: item.year,
          month: item.month,
          period: item.period,
          type: 'active',
          isCompatibilityFixture: false,
          total_occurrences: item.total_occurrences,
          total_municipalities: item.total_municipalities,
          metadata: response.meta,
        }));

        PERIODS_CACHE = activePeriods;
        return activePeriods;
      } catch (apiError: unknown) {
        if (isRecoverableApiError(apiError)) {
          if (isDevelopmentEnvironment()) {
            console.warn(
              `[CrimeHistoryService] Falha recuperável na consulta de períodos da Gardio API. ` +
              `Acionando fallback para períodos estáticos de compatibilidade. Detalhes: ${
                apiError instanceof Error ? apiError.message : String(apiError)
              }`
            );
          }
          const fallbackPeriods = [...STATIC_COMPATIBILITY_PERIODS];
          PERIODS_CACHE = fallbackPeriods;
          return fallbackPeriods;
        }
        throw apiError;
      }
    }

    const firebasePeriods = [...STATIC_COMPATIBILITY_PERIODS];
    PERIODS_CACHE = firebasePeriods;
    return firebasePeriods;
  })()
    .then((result) => {
      PENDING_PERIODS_REQUEST = null;
      return result;
    })
    .catch((error) => {
      PENDING_PERIODS_REQUEST = null;
      throw error;
    });

  PENDING_PERIODS_REQUEST = request;
  return request;
};

/**
 * Retorna a lista unificada de períodos selecionáveis pelo usuário:
 * 1. Períodos ativos retornados pela API (via fetchAvailablePeriods);
 * 2. Períodos estáticos de compatibilidade (STATIC_COMPATIBILITY_PERIODS);
 *
 * Regras:
 * - Em caso de duplicidade de mês/ano, a classificação 'active' tem precedência sobre 'compatibility';
 * - Não duplica períodos;
 * - Ordenados do mais recente para o mais antigo (ex: 2026-07 antes de 2026-02);
 * - Se a API falhar ou estiver em modo Firebase, disponibiliza os períodos de compatibilidade;
 * - Preserva o cache e a deduplicação de fetchAvailablePeriods.
 */
export const fetchSelectablePeriods = async (
  forceRefresh: boolean = false
): Promise<CrimePeriodInfo[]> => {
  let activePeriods: CrimePeriodInfo[] = [];
  try {
    activePeriods = await fetchAvailablePeriods(forceRefresh);
  } catch {
    activePeriods = [];
  }

  const periodsMap = new Map<string, CrimePeriodInfo>();

  // 1. Registra períodos estáticos de compatibilidade (ex: 02/2026)
  for (const p of STATIC_COMPATIBILITY_PERIODS) {
    periodsMap.set(p.period, p);
  }

  // 2. Registra ou sobrescreve com períodos ativos retornados pela API
  for (const p of activePeriods) {
    const existing = periodsMap.get(p.period);
    if (!existing || p.type === 'active') {
      periodsMap.set(p.period, p);
    }
  }

  // 3. Ordenação cronológica decrescente (ano descendente, depois mês descendente)
  return Array.from(periodsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
};
