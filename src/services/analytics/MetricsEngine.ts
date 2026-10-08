import { CrimeCategory, CategoryMetric, PeriodComparison } from './types';
import { lifeCrimesKeys, physicalCrimesKeys, patrimonyCrimesKeys, formatCrimeName } from '../../constants/CrimeData';

export const calculateTotalOccurrences = (data: Record<string, any>): number => {
  let total = 0;
  for (const key of Object.keys(data)) {
    if (key === 'nome_da_cidade' || key === 'timestamp') continue;
    const locs = data[key]?.localizacoes;
    if (Array.isArray(locs)) {
      total += locs.length;
    }
  }
  return total;
};

export const calculateCategoryTotals = (data: Record<string, any>): Record<CrimeCategory, number> => {
  let life = 0;
  let physical = 0;
  let patrimony = 0;

  for (const key of lifeCrimesKeys) {
    const locs = data[key]?.localizacoes;
    if (Array.isArray(locs)) life += locs.length;
  }
  for (const key of physicalCrimesKeys) {
    const locs = data[key]?.localizacoes;
    if (Array.isArray(locs)) physical += locs.length;
  }
  for (const key of patrimonyCrimesKeys) {
    const locs = data[key]?.localizacoes;
    if (Array.isArray(locs)) patrimony += locs.length;
  }

  return { life, physical, patrimony };
};

export const calculateCategoryShares = (totals: Record<CrimeCategory, number>, totalOccurrences: number): CategoryMetric[] => {
  if (totalOccurrences === 0) {
    return [
      { id: 'life' as CrimeCategory, total: 0, percentage: 0 },
      { id: 'physical' as CrimeCategory, total: 0, percentage: 0 },
      { id: 'patrimony' as CrimeCategory, total: 0, percentage: 0 },
    ];
  }

  return [
    { id: 'patrimony' as CrimeCategory, total: totals.patrimony, percentage: (totals.patrimony / totalOccurrences) * 100 },
    { id: 'physical' as CrimeCategory, total: totals.physical, percentage: (totals.physical / totalOccurrences) * 100 },
    { id: 'life' as CrimeCategory, total: totals.life, percentage: (totals.life / totalOccurrences) * 100 },
  ].sort((a, b) => b.percentage - a.percentage); // Descending
};

export const calculateDominantCategory = (categories: CategoryMetric[]): CrimeCategory | undefined => {
  if (categories.length === 0 || categories[0].total === 0) return undefined;
  return categories[0].id;
};

export const calculateDominantCrime = (data: Record<string, any>, totalOccurrences: number) => {
  if (totalOccurrences === 0) return undefined;

  let maxCount = -1;
  let dominantKey = '';

  for (const key of Object.keys(data)) {
    if (key === 'nome_da_cidade' || key === 'timestamp') continue;
    const locs = data[key]?.localizacoes;
    if (Array.isArray(locs)) {
      if (locs.length > maxCount) {
        maxCount = locs.length;
        dominantKey = key;
      }
    }
  }

  if (maxCount <= 0) return undefined;

  return {
    name: formatCrimeName(dominantKey),
    total: maxCount,
    percentage: (maxCount / totalOccurrences) * 100,
  };
};

export const calculateRatePer100k = (total: number, population?: number): number | undefined => {
  if (!population || population <= 0) return undefined;
  return (total / population) * 100000;
};

export const calculatePeriodComparison = (current: number, previous: number): PeriodComparison => {
  const absoluteChange = current - previous;
  let percentageChange = null;

  if (previous > 0) {
    percentageChange = (absoluteChange / previous) * 100;
  }

  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
  };
};

export const calculateMovingAverage = (
  values: { value: number; absoluteMonth: number }[],
  period: number = 3
): (number | undefined)[] => {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else {
      let sum = 0;
      let isConsecutive = true;
      for (let j = 0; j < period; j++) {
        sum += values[i - j].value;
        if (j > 0) {
          const diff = values[i - j + 1].absoluteMonth - values[i - j].absoluteMonth;
          if (diff !== 1) {
            isConsecutive = false;
            break;
          }
        }
      }
      if (isConsecutive) {
        result.push(sum / period);
      } else {
        result.push(undefined);
      }
    }
  }
  return result;
};
