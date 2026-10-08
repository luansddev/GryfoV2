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

export interface AnalysisResult {
  city: string;
  population?: number;
  totalOccurrences: number;
  ratePer100k?: number;
  categories: CategoryMetric[];
  dominantCategory?: CrimeCategory;
  dominantCrime?: {
    name: string;
    total: number;
    percentage: number;
  };
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
}
