/**
 * src/services/api/types.ts
 * Contratos de tipos para a integração HTTP com a Gardio Intelligence API.
 */

/**
 * Localização geográfica individual de uma ocorrência no formato legado da SSP-SP.
 */
export interface LegacyLocationPoint {
  latitude: number;
  longitude: number;
}

/**
 * Registro de crime por natureza criminal no formato legado da SSP-SP.
 */
export interface LegacyCrimeRecord {
  quantidade: number;
  localizacoes: LegacyLocationPoint[];
}

/**
 * Payload estrutural legado da SSP-SP (formato do ssp-{month}-{year}.json).
 * Estruturalmente compatível com `RawCrimeData` utilizado no app.
 */
export interface LegacySspPayload {
  [city: string]: {
    [crimeType: string]: LegacyCrimeRecord;
  };
}

/**
 * Período histórico com dados criminais oficiais ativos.
 * Contrato real retornado por GET /v1/periods.
 */
export interface AvailablePeriod {
  year: number;
  month: number;
  period: string; // Ex.: "2026-02"
  total_occurrences: number;
  total_municipalities: number;
}

/**
 * Metadados do envelope de resposta da API (StandardResponse).
 */
export interface ResponseMetadata {
  dataset_id?: string | null;
  data_version?: string | null;
  source?: string;
  published_at?: string | null;
  period?: string | null;
  geographic_resolution?: string;
  methodology?: string;
}

/**
 * Envelope de resposta retornado por GET /v1/periods.
 */
export interface PeriodsResponse {
  data: AvailablePeriod[];
  meta?: ResponseMetadata;
}

/**
 * Resposta de verificação de prontidão retornada por GET /health/ready.
 */
export interface HealthReadyResponse {
  status: 'ready' | string;
  database: 'connected' | string;
  service: string;
}

