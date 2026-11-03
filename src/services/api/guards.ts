/**
 * src/services/api/guards.ts
 * Validadores manuais leves para garantir a integridade dos contratos de dados da API.
 */

import {
  LegacySspPayload,
  AvailablePeriod,
  PeriodsResponse,
  HealthReadyResponse,
  TopCrimeItem,
  MunicipalitySummary,
  MunicipalitySummaryResponse,
  StatewideBenchmark,
  StatewideBenchmarkResponse,
} from './types';

/**
 * Valida se um valor desconhecido é um payload legado compatível com a SSP-SP.
 * Rejeita objetos de erro do FastAPI (ex.: {"detail": "Not Found"}),
 * objetos vazios ou estruturas com tipos incorretos.
 */
export function isLegacySspPayload(value: unknown): value is LegacySspPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  // Rejeita envelopes comuns de erro
  if ('detail' in record || 'error' in record) {
    return false;
  }

  const cityKeys = Object.keys(record);
  if (cityKeys.length === 0) {
    return false;
  }

  for (const city of cityKeys) {
    const cityData = record[city];
    if (!cityData || typeof cityData !== 'object' || Array.isArray(cityData)) {
      return false;
    }

    const crimeKeys = Object.keys(cityData as Record<string, unknown>);
    if (crimeKeys.length === 0) {
      return false;
    }

    for (const crime of crimeKeys) {
      const entry = (cityData as Record<string, unknown>)[crime];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false;
      }

      const e = entry as Record<string, unknown>;
      if (typeof e.quantidade !== 'number' || !Number.isFinite(e.quantidade)) {
        return false;
      }

      if (!Array.isArray(e.localizacoes)) {
        return false;
      }

      // Valida uma amostra das localizações para garantir tipagem numérica das coordenadas
      const locs = e.localizacoes;
      const sampleSize = Math.min(locs.length, 3);
      for (let i = 0; i < sampleSize; i++) {
        const loc = locs[i];
        if (!loc || typeof loc !== 'object' || Array.isArray(loc)) {
          return false;
        }

        const l = loc as Record<string, unknown>;
        if (
          typeof l.latitude !== 'number' ||
          !Number.isFinite(l.latitude) ||
          typeof l.longitude !== 'number' ||
          !Number.isFinite(l.longitude)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Valida um único item de período histórico retornado pela API.
 */
export function isAvailablePeriod(value: unknown): value is AvailablePeriod {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.year === 'number' &&
    Number.isInteger(v.year) &&
    v.year >= 2000 &&
    v.year <= 2100 &&
    typeof v.month === 'number' &&
    Number.isInteger(v.month) &&
    v.month >= 1 &&
    v.month <= 12 &&
    typeof v.period === 'string' &&
    /^\d{4}-\d{2}$/.test(v.period) &&
    typeof v.total_occurrences === 'number' &&
    Number.isFinite(v.total_occurrences) &&
    v.total_occurrences >= 0 &&
    typeof v.total_municipalities === 'number' &&
    Number.isFinite(v.total_municipalities) &&
    v.total_municipalities >= 0
  );
}

/**
 * Valida a resposta do endpoint GET /v1/periods.
 */
export function isPeriodsResponse(value: unknown): value is PeriodsResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.data)) {
    return false;
  }

  return v.data.every(isAvailablePeriod);
}

/**
 * Valida a resposta do endpoint de prontidão GET /health/ready.
 */
export function isHealthReadyResponse(value: unknown): value is HealthReadyResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.status === 'string' &&
    v.status === 'ready' &&
    typeof v.database === 'string' &&
    v.database === 'connected' &&
    typeof v.service === 'string' &&
    v.service.length > 0
  );
}

/**
 * Helper interno: valida se um objeto é um Record<string, number> com números finitos e não negativos.
 */
function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const rec = value as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    const val = rec[key];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Valida um único item do ranking dos crimes mais frequentes (TopCrimeItem).
 */
export function isTopCrimeItem(value: unknown): value is TopCrimeItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.nature_code === 'string' &&
    v.nature_code.length > 0 &&
    typeof v.nature_name === 'string' &&
    v.nature_name.length > 0 &&
    typeof v.category === 'string' &&
    v.category.length > 0 &&
    typeof v.quantity === 'number' &&
    Number.isFinite(v.quantity) &&
    v.quantity >= 0 &&
    typeof v.percentage === 'number' &&
    Number.isFinite(v.percentage) &&
    v.percentage >= 0
  );
}

/**
 * Valida a estrutura de dados de MunicipalitySummary retornada pela API.
 */
export function isMunicipalitySummary(value: unknown): value is MunicipalitySummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.municipality_key === 'string' &&
    v.municipality_key.length > 0 &&
    typeof v.municipality_name === 'string' &&
    v.municipality_name.length > 0 &&
    typeof v.year === 'number' &&
    Number.isInteger(v.year) &&
    v.year >= 2000 &&
    v.year <= 2100 &&
    typeof v.month === 'number' &&
    Number.isInteger(v.month) &&
    v.month >= 1 &&
    v.month <= 12 &&
    typeof v.period === 'string' &&
    /^\d{4}-\d{2}$/.test(v.period) &&
    (v.population_2022 === null ||
      (typeof v.population_2022 === 'number' &&
        Number.isFinite(v.population_2022) &&
        v.population_2022 >= 0)) &&
    typeof v.total_occurrences === 'number' &&
    Number.isFinite(v.total_occurrences) &&
    v.total_occurrences >= 0 &&
    (v.rate_per_100k === null ||
      (typeof v.rate_per_100k === 'number' &&
        Number.isFinite(v.rate_per_100k) &&
        v.rate_per_100k >= 0)) &&
    isNumberRecord(v.category_totals) &&
    isNumberRecord(v.category_shares) &&
    Array.isArray(v.top_crimes) &&
    v.top_crimes.every(isTopCrimeItem)
  );
}

/**
 * Valida o envelope StandardResponse retornado por GET /v1/crime-statistics/summary.
 */
export function isMunicipalitySummaryResponse(
  value: unknown
): value is MunicipalitySummaryResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;

  // Rejeita envelopes comuns de erro
  if ('detail' in v || 'error' in v) {
    return false;
  }

  return isMunicipalitySummary(v.data);
}

/**
 * Valida a estrutura de dados de StatewideBenchmark retornada pela API.
 */
export function isStatewideBenchmark(value: unknown): value is StatewideBenchmark {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.state === 'string' &&
    v.state.length > 0 &&
    typeof v.year === 'number' &&
    Number.isInteger(v.year) &&
    v.year >= 2000 &&
    v.year <= 2100 &&
    typeof v.month === 'number' &&
    Number.isInteger(v.month) &&
    v.month >= 1 &&
    v.month <= 12 &&
    typeof v.period === 'string' &&
    /^\d{4}-\d{2}$/.test(v.period) &&
    typeof v.total_occurrences === 'number' &&
    Number.isFinite(v.total_occurrences) &&
    v.total_occurrences >= 0 &&
    (v.state_population === null ||
      (typeof v.state_population === 'number' &&
        Number.isFinite(v.state_population) &&
        v.state_population >= 0)) &&
    (v.rate_per_100k === null ||
      (typeof v.rate_per_100k === 'number' &&
        Number.isFinite(v.rate_per_100k) &&
        v.rate_per_100k >= 0)) &&
    isNumberRecord(v.category_totals) &&
    isNumberRecord(v.category_shares) &&
    (v.covered_municipalities === null ||
      (typeof v.covered_municipalities === 'number' &&
        Number.isFinite(v.covered_municipalities) &&
        v.covered_municipalities >= 0)) &&
    (v.covered_population === null ||
      (typeof v.covered_population === 'number' &&
        Number.isFinite(v.covered_population) &&
        v.covered_population >= 0)) &&
    (v.covered_rate_per_100k === null ||
      (typeof v.covered_rate_per_100k === 'number' &&
        Number.isFinite(v.covered_rate_per_100k) &&
        v.covered_rate_per_100k >= 0))
  );
}

/**
 * Valida o envelope StandardResponse retornado por GET /v1/crime-statistics/benchmark.
 */
export function isStatewideBenchmarkResponse(
  value: unknown
): value is StatewideBenchmarkResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;

  // Rejeita envelopes comuns de erro
  if ('detail' in v || 'error' in v) {
    return false;
  }

  return isStatewideBenchmark(v.data);
}
