import { apiConfig, isDevelopmentEnvironment } from '../../config/api';
import { getLegacyPeriod } from '../api/gardioApi';
import { ApiError } from '../api/httpClient';

export interface RawCrimeData {
  [city: string]: {
    [crimeType: string]: {
      quantidade: number;
      localizacoes: { latitude: number; longitude: number }[];
    };
  };
}

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
