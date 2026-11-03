/**
 * src/services/analytics/apiAnalysisAdapter.ts
 * Adaptador analítico para consumo dos endpoints Summary e Benchmark da Gardio API.
 * Gerencia cache em memória composto, deduplicação de chamadas concorrentes e
 * mapeamento estrutural fiel para AnalysisResult.
 */

import { apiConfig } from '../../config/api';
import {
  getCrimeStatisticsSummary,
  getCrimeStatisticsBenchmark,
} from '../api/gardioApi';
import {
  MunicipalitySummary,
  StatewideBenchmark,
} from '../api/types';
import {
  AnalysisResult,
  CategoryMetric,
  CrimeCategory,
  CrimeRankItem,
  StateBenchmark,
} from './types';
import { generateInsights } from './InsightEngine';
import { generateRecommendations } from './RecommendationEngine';

/**
 * Erro lançado quando os períodos retornados pela API não conferem com o período solicitado
 * ou quando Summary e Benchmark apresentam períodos divergentes entre si.
 */
export class PeriodMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodMismatchError';
  }
}

const SUMMARY_CACHE = new Map<string, MunicipalitySummary>();
const BENCHMARK_CACHE = new Map<string, StatewideBenchmark>();
const PENDING_SUMMARY = new Map<string, Promise<MunicipalitySummary>>();
const PENDING_BENCHMARK = new Map<string, Promise<StatewideBenchmark>>();

/**
 * Limpa o cache em memória e promessas pendentes (útil em testes e trocas de contexto).
 */
export const clearApiAnalysisCache = (): void => {
  SUMMARY_CACHE.clear();
  BENCHMARK_CACHE.clear();
  PENDING_SUMMARY.clear();
  PENDING_BENCHMARK.clear();
};

/**
 * Consulta o resumo do município na API com cache e deduplicação de requisições em voo.
 * Chave de cache composta: fonte:município:ano-mês.
 */
export async function fetchSummaryWithDeduplication(
  municipality: string,
  year: number,
  month: number,
  forceRefresh: boolean = false
): Promise<MunicipalitySummary> {
  const cacheKey = `${apiConfig.source}:${municipality.trim().toUpperCase()}:${year}-${month}`;

  if (!forceRefresh && SUMMARY_CACHE.has(cacheKey)) {
    return SUMMARY_CACHE.get(cacheKey)!;
  }

  if (!forceRefresh && PENDING_SUMMARY.has(cacheKey)) {
    return PENDING_SUMMARY.get(cacheKey)!;
  }

  const promise = getCrimeStatisticsSummary(municipality, year, month)
    .then((res) => {
      PENDING_SUMMARY.delete(cacheKey);
      if (res.data.year !== year || res.data.month !== month) {
        throw new PeriodMismatchError(
          `Summary retornou período diferente do solicitado: esperado ${year}-${month}, recebido ${res.data.year}-${res.data.month}`
        );
      }
      SUMMARY_CACHE.set(cacheKey, res.data);
      return res.data;
    })
    .catch((err) => {
      PENDING_SUMMARY.delete(cacheKey);
      throw err;
    });

  PENDING_SUMMARY.set(cacheKey, promise);
  return promise;
}

/**
 * Consulta o benchmark estadual na API com cache e deduplicação de requisições em voo.
 * Chave de cache composta: fonte:ano-mês.
 */
export async function fetchBenchmarkWithDeduplication(
  year: number,
  month: number,
  forceRefresh: boolean = false
): Promise<StatewideBenchmark> {
  const cacheKey = `${apiConfig.source}:${year}-${month}`;

  if (!forceRefresh && BENCHMARK_CACHE.has(cacheKey)) {
    return BENCHMARK_CACHE.get(cacheKey)!;
  }

  if (!forceRefresh && PENDING_BENCHMARK.has(cacheKey)) {
    return PENDING_BENCHMARK.get(cacheKey)!;
  }

  const promise = getCrimeStatisticsBenchmark(year, month)
    .then((res) => {
      PENDING_BENCHMARK.delete(cacheKey);
      if (res.data.year !== year || res.data.month !== month) {
        throw new PeriodMismatchError(
          `Benchmark retornou período diferente do solicitado: esperado ${year}-${month}, recebido ${res.data.year}-${res.data.month}`
        );
      }
      BENCHMARK_CACHE.set(cacheKey, res.data);
      return res.data;
    })
    .catch((err) => {
      PENDING_BENCHMARK.delete(cacheKey);
      throw err;
    });

  PENDING_BENCHMARK.set(cacheKey, promise);
  return promise;
}

/**
 * Converte os dados oficiais de Summary e Benchmark retornados pela API
 * para a interface AnalysisResult consumida pelas telas do app.
 *
 * Preserva estritamente:
 * - Nulls e distinções de taxas (rate_per_100k vs covered_rate_per_100k).
 * - Ausência de população sem recalcular taxas arbitrárias.
 * - Categorias e contagens fornecidas diretamente pelo backend.
 */
export function mapApiAnalyticsToAnalysisResult(
  summary: MunicipalitySummary,
  benchmark: StatewideBenchmark
): AnalysisResult {
  if (summary.year !== benchmark.year || summary.month !== benchmark.month) {
    throw new PeriodMismatchError(
      `Inconsistência de período entre Summary (${summary.year}-${summary.month}) e Benchmark (${benchmark.year}-${benchmark.month})`
    );
  }

  // 1. Mapeamento das categorias da API para os slugs do app
  const categories: CategoryMetric[] = [
    {
      id: 'patrimony' as CrimeCategory,
      total: summary.category_totals['patrimonio'] ?? 0,
      percentage: summary.category_shares['patrimonio'] ?? 0,
    },
    {
      id: 'physical' as CrimeCategory,
      total: summary.category_totals['integridade_fisica'] ?? 0,
      percentage: summary.category_shares['integridade_fisica'] ?? 0,
    },
    {
      id: 'life' as CrimeCategory,
      total: summary.category_totals['vida'] ?? 0,
      percentage: summary.category_shares['vida'] ?? 0,
    },
  ].sort((a, b) => b.percentage - a.percentage);

  const dominantCategory = categories[0]?.total > 0 ? categories[0].id : undefined;

  // 2. Mapeamento de Top Crimes e Dominante
  const topCrimes: CrimeRankItem[] = (summary.top_crimes || []).map((item) => ({
    key: item.nature_code,
    name: item.nature_name,
    total: item.quantity,
    percentage: item.percentage,
  }));

  const dominantCrime =
    topCrimes.length > 0 && topCrimes[0].total > 0
      ? {
          name: topCrimes[0].name,
          total: topCrimes[0].total,
          percentage: topCrimes[0].percentage,
        }
      : undefined;

  // 3. Taxas por categoria no município e no estado
  const cityPop = summary.population_2022;
  const coveredPop = benchmark.covered_population;

  const cityCategoryRates: Record<CrimeCategory, number> | undefined =
    cityPop && cityPop > 0
      ? {
          patrimony: ((summary.category_totals['patrimonio'] ?? 0) / cityPop) * 100000,
          physical: ((summary.category_totals['integridade_fisica'] ?? 0) / cityPop) * 100000,
          life: ((summary.category_totals['vida'] ?? 0) / cityPop) * 100000,
        }
      : undefined;

  const stateCategoryRates: Record<CrimeCategory, number> | undefined =
    benchmark.rate_per_100k !== null && benchmark.state_population && benchmark.state_population > 0
      ? {
          patrimony: ((benchmark.category_totals['patrimonio'] ?? 0) / benchmark.state_population) * 100000,
          physical: ((benchmark.category_totals['integridade_fisica'] ?? 0) / benchmark.state_population) * 100000,
          life: ((benchmark.category_totals['vida'] ?? 0) / benchmark.state_population) * 100000,
        }
      : undefined;

  // 4. Benchmark estruturado com cobertura explícita
  const benchmarkResult: StateBenchmark = {
    stateTotal: benchmark.total_occurrences,
    stateCategoryShares: {
      patrimony: benchmark.category_shares['patrimonio'] ?? 0,
      physical: benchmark.category_shares['integridade_fisica'] ?? 0,
      life: benchmark.category_shares['vida'] ?? 0,
    },
    // Rigor semântico: se a taxa geral for nula (cobertura parcial), stateRatePer100k permanece undefined.
    // A taxa dos municípios cobertos é preservada exclusivamente em coveredRatePer100k.
    stateRatePer100k: benchmark.rate_per_100k !== null ? benchmark.rate_per_100k : undefined,
    coveredRatePer100k: benchmark.covered_rate_per_100k,
    coveredMunicipalities: benchmark.covered_municipalities,
    coveredPopulation: benchmark.covered_population,
    statePopulation: benchmark.state_population,
    isPartialCoverage: benchmark.rate_per_100k === null,
    cityCategoryRates,
    stateCategoryRates,
  };

  // 5. Metadados de qualidade e histórico
  const monthStr = summary.month.toString().padStart(2, '0');
  const periodStr = `${monthStr}/${summary.year}`;

  const dataQuality = {
    availableMonths: 1,
    firstPeriod: periodStr,
    lastPeriod: periodStr,
    hasPopulation: summary.population_2022 !== null,
    hasEnoughHistoryForTrend: false,
    hasEnoughHistoryForYoY: false,
  };

  const trend = {
    points: [
      {
        year: summary.year,
        month: summary.month,
        total: summary.total_occurrences,
      },
    ],
  };

  const rawCrimes: Record<string, number> = {};
  for (const tc of summary.top_crimes || []) {
    rawCrimes[tc.nature_name] = tc.quantity;
  }

  const partialAnalysis: Partial<AnalysisResult> = {
    city: summary.municipality_key,
    displayName: summary.municipality_name,
    population: summary.population_2022 !== null ? summary.population_2022 : undefined,
    totalOccurrences: summary.total_occurrences,
    ratePer100k: summary.rate_per_100k !== null ? summary.rate_per_100k : undefined,
    categories,
    otherTotal: summary.category_totals['outros'] ?? 0,
    dominantCategory,
    dominantCrime,
    topCrimes,
    benchmark: benchmarkResult,
    trend,
    dataQuality,
    rawCrimes,
  };

  const insights = generateInsights(partialAnalysis);
  const recommendations = generateRecommendations(partialAnalysis);

  return {
    ...partialAnalysis,
    city: summary.municipality_key,
    totalOccurrences: summary.total_occurrences,
    categories,
    insights,
    recommendations,
    dataQuality,
  };
}

/**
 * Executa a análise criminal completa via Gardio API para um período ativo específico.
 */
export async function fetchApiCrimeAnalysis(
  municipality: string,
  year: number,
  month: number,
  forceRefresh: boolean = false
): Promise<AnalysisResult> {
  const [summary, benchmark] = await Promise.all([
    fetchSummaryWithDeduplication(municipality, year, month, forceRefresh),
    fetchBenchmarkWithDeduplication(year, month, forceRefresh),
  ]);

  if (summary.year !== year || summary.month !== month) {
    throw new PeriodMismatchError(
      `Summary retornou período diferente do solicitado: esperado ${year}-${month}, recebido ${summary.year}-${summary.month}`
    );
  }
  if (benchmark.year !== year || benchmark.month !== month) {
    throw new PeriodMismatchError(
      `Benchmark retornou período diferente do solicitado: esperado ${year}-${month}, recebido ${benchmark.year}-${benchmark.month}`
    );
  }
  if (summary.year !== benchmark.year || summary.month !== benchmark.month) {
    throw new PeriodMismatchError(
      `Inconsistência de período entre Summary (${summary.year}-${summary.month}) e Benchmark (${benchmark.year}-${benchmark.month})`
    );
  }

  return mapApiAnalyticsToAnalysisResult(summary, benchmark);
}
