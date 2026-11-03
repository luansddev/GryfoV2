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
 * Envelope genérico de resposta padrão da Gardio API (StandardResponse[T]).
 */
export interface StandardResponse<T> {
  data: T;
  meta?: ResponseMetadata;
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

/**
 * Item do ranking das naturezas criminais com maior incidência no município.
 * Contrato retornado por GET /v1/crime-statistics/summary.
 */
export interface TopCrimeItem {
  nature_code: string;
  nature_name: string;
  category: string;
  quantity: number;
  percentage: number;
}

/**
 * Panorama executivo consolidado de estatísticas criminais de um município.
 * Contrato real retornado por GET /v1/crime-statistics/summary.
 */
export interface MunicipalitySummary {
  municipality_key: string;
  municipality_name: string;
  year: number;
  month: number;
  period: string; // Padrão "YYYY-MM" (ex: "2026-07")
  /**
   * População oficial do município segundo o Censo 2022 do IBGE.
   * Null se o município não possuir contagem populacional catalogada.
   */
  population_2022: number | null;
  /**
   * Volume total consolidado de ocorrências criminais no período.
   */
  total_occurrences: number;
  /**
   * Taxa criminal por 100 mil habitantes calculada sobre a população do Censo 2022.
   * Null se population_2022 for nulo ou igual a zero.
   */
  rate_per_100k: number | null;
  /**
   * Quantidade de ocorrências agrupadas pelas 4 macrocategorias da taxonomia oficial da API:
   * 'vida', 'integridade_fisica', 'patrimonio', 'outros'.
   */
  category_totals: Record<string, number>;
  /**
   * Participação percentual de cada macrocategoria no total de ocorrências.
   */
  category_shares: Record<string, number>;
  /**
   * Lista ordenada das naturezas criminais mais frequentes no município (Top 5).
   */
  top_crimes: TopCrimeItem[];
}

/**
 * Envelope retornado por GET /v1/crime-statistics/summary.
 */
export type MunicipalitySummaryResponse = StandardResponse<MunicipalitySummary>;

/**
 * Benchmark consolidado de referência estatística de todo o Estado de São Paulo.
 * Contrato real retornado por GET /v1/crime-statistics/benchmark.
 *
 * Distinções semânticas importantes de cobertura e taxas:
 * - `state_population`: População de todos os 645 municípios paulistas catalogados.
 * - `covered_municipalities`: Quantidade de municípios paulistas que efetivamente possuem registros no período.
 * - `covered_population`: População somada exclusivamente dos municípios cobertos.
 * - `rate_per_100k`: Taxa geral sobre o Estado inteiro. É `null` quando a cobertura do período for parcial (ex: 626/645).
 * - `covered_rate_per_100k`: Taxa calculada estritamente sobre a população coberta (total_occurrences / covered_population * 100.000).
 */
export interface StatewideBenchmark {
  state: string; // Ex: "SP"
  year: number;
  month: number;
  period: string; // Padrão "YYYY-MM" (ex: "2026-07")
  total_occurrences: number;
  /**
   * População total oficial do Estado (soma dos 645 municípios paulistas catalogados).
   * Null se indisponível.
   */
  state_population: number | null;
  /**
   * Taxa criminal por 100 mil habitantes sobre o Estado inteiro.
   * IMPORTANTE: A API define este campo como `null` quando a cobertura territorial for parcial
   * (ex: 626 de 645 municípios), pois não assume ocorrência zero para municípios não cobertos.
   */
  rate_per_100k: number | null;
  category_totals: Record<string, number>;
  category_shares: Record<string, number>;
  /**
   * Quantidade de municípios paulistas com dados registrados e cobertos no período (ex: 626 em 07/2026).
   * Null se indisponível.
   */
  covered_municipalities: number | null;
  /**
   * População somada dos municípios paulistas efetivamente cobertos (ex: 44.358.687 em 07/2026).
   * Null se indisponível.
   */
  covered_population: number | null;
  /**
   * Taxa por 100 mil habitantes calculada especificamente sobre a população coberta.
   * É o indicador estatístico efetivo quando a cobertura é parcial (ex: 203.38 em 07/2026).
   * Null se covered_population for nulo ou zero.
   */
  covered_rate_per_100k: number | null;
}

/**
 * Envelope retornado por GET /v1/crime-statistics/benchmark.
 */
export type StatewideBenchmarkResponse = StandardResponse<StatewideBenchmark>;
