import { CrimeTrendPoint, PeriodComparison } from './types';
import { calculateMovingAverage, calculatePeriodComparison } from './MetricsEngine';

export const analyzeTrend = (
  monthlyData: { year: number; month: number; total: number }[]
): {
  points: CrimeTrendPoint[];
  periodChange?: PeriodComparison;
  yearOverYearChange?: PeriodComparison;
} => {
  // Sort data chronologically
  const sorted = [...monthlyData].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const movingAverages = calculateMovingAverage(
    sorted.map(d => ({ value: d.total, absoluteMonth: d.year * 12 + d.month })),
    3
  );

  const points: CrimeTrendPoint[] = sorted.map((d, i) => ({
    ...d,
    movingAverage3: movingAverages[i],
  }));

  let periodChange: PeriodComparison | undefined;
  if (sorted.length >= 2) {
    const currentPoint = sorted[sorted.length - 1];
    const previousPoint = sorted[sorted.length - 2];
    
    const isConsecutive = (currentPoint.year * 12 + currentPoint.month) - (previousPoint.year * 12 + previousPoint.month) === 1;
    
    if (isConsecutive) {
      periodChange = calculatePeriodComparison(currentPoint.total, previousPoint.total);
    }
  }

  let yearOverYearChange: PeriodComparison | undefined;
  if (sorted.length >= 2) {
    const currentPoint = sorted[sorted.length - 1];
    // Find exactly 12 months ago
    const previousPoint = sorted.find(p => p.year === currentPoint.year - 1 && p.month === currentPoint.month);
    
    if (previousPoint) {
      yearOverYearChange = calculatePeriodComparison(currentPoint.total, previousPoint.total);
    }
  }

  return { points, periodChange, yearOverYearChange };
};
