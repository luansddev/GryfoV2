export type CrimeCategory = 'life' | 'physical' | 'patrimony';

export interface MonthlyCrimeData {
  year: number;
  month: number;
  total: number;
  categories: {
    life: number;
    physical: number;
    patrimony: number;
  };
  crimes: Record<string, number>;
}

export interface CategoryMetric {
  id: CrimeCategory;
  total: number;
  percentage: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number | null;
}

export interface CrimeTrendPoint {
  year: number;
  month: number;
  total: number;
  movingAverage3?: number;
}

export interface AnalysisInsight {
  id: string;
  type: 'information' | 'increase' | 'decrease' | 'neutral' | 'warning';
  title: string;
  description: string;
  priority: number;
}

export interface CrimeRankItem {
  key: string;
  name: string;
  total: number;
  percentage: number;
}

export interface StateBenchmark {
  /** Total de registros no estado inteiro no mesmo período */
  stateTotal: number;
  /** Participação (%) de cada categoria no total do estado */
  stateCategoryShares: Record<CrimeCategory, number>;
  /** Taxa estadual por 100 mil habitantes (soma dos municípios com população conhecida) */
  stateRatePer100k?: number;
  /** Taxas por 100 mil hab., por categoria */
  stateCategoryRates?: Record<CrimeCategory, number>;
  cityCategoryRates?: Record<CrimeCategory, number>;
  /** Posição da cidade entre os municípios paulistas, ordenados da MENOR para a MAIOR taxa */
  rateRank?: {
    position: number;
    outOf: number;
    /** % de cidades que têm taxa MAIOR que a desta cidade */
    lowerThanPct: number;
  };
}

export interface AnalysisResult {
  city: string;
  /** Nome oficial e legível (ex: "São José dos Campos") */
  displayName?: string;
  population?: number;
  totalOccurrences: number;
  ratePer100k?: number;
  categories: CategoryMetric[];
  /** Registros que não pertencem às 3 categorias principais (ex: entorpecentes, porte de arma) */
  otherTotal?: number;
  dominantCategory?: CrimeCategory;
  dominantCrime?: {
    name: string;
    total: number;
    percentage: number;
  };
  topCrimes?: CrimeRankItem[];
  benchmark?: StateBenchmark;
  trend?: {
    points: CrimeTrendPoint[];
    periodChange?: PeriodComparison;
    yearOverYearChange?: PeriodComparison;
  };
  insights: AnalysisInsight[];
  recommendations: AnalysisInsight[];
  dataQuality: {
    availableMonths: number;
    firstPeriod?: string;
    lastPeriod?: string;
    hasPopulation: boolean;
    hasEnoughHistoryForTrend: boolean;
    hasEnoughHistoryForYoY: boolean;
  };
  rawCrimes?: Record<string, number>;
  monthlyCrimes?: {
    year: number;
    month: number;
    crimes: Record<string, number>;
    total: number;
  }[];
  stateCrimeTotals?: Record<string, number>;
}
