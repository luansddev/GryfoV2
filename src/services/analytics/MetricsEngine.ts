import { CrimeCategory, CategoryMetric, PeriodComparison, CrimeRankItem, StateBenchmark } from './types';
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

const IGNORED_KEYS = ['nome_da_cidade', 'timestamp'];

/** As N naturezas criminais mais registradas na cidade */
export const calculateTopCrimes = (
  data: Record<string, any>,
  totalOccurrences: number,
  limit: number = 5
): CrimeRankItem[] => {
  if (totalOccurrences === 0) return [];
  const items: CrimeRankItem[] = [];
  for (const key of Object.keys(data)) {
    if (IGNORED_KEYS.includes(key)) continue;
    const locs = data[key]?.localizacoes;
    const total = Array.isArray(locs) ? locs.length : 0;
    if (total <= 0) continue;
    items.push({ key, name: formatCrimeName(key), total, percentage: (total / totalOccurrences) * 100 });
  }
  return items.sort((a, b) => b.total - a.total).slice(0, limit);
};

/**
 * Compara a cidade com o estado de São Paulo inteiro no mesmo período.
 * @param allCities  JSON completo da SSP (todas as cidades)
 * @param cityKey    chave da cidade analisada
 * @param getPopulation  função que devolve a população de uma chave da SSP (ou undefined)
 */
export const calculateStateBenchmark = (
  allCities: Record<string, any>,
  cityKey: string,
  getPopulation: (sspKey: string) => number | undefined
): StateBenchmark => {
  let stateTotal = 0;
  const stateCat: Record<CrimeCategory, number> = { life: 0, physical: 0, patrimony: 0 };

  // Somatórios apenas de cidades com população conhecida (para taxas comparáveis)
  let popTotal = 0;
  let popRecords = 0;
  const popCat: Record<CrimeCategory, number> = { life: 0, physical: 0, patrimony: 0 };
  const rates: { key: string; rate: number }[] = [];

  for (const key of Object.keys(allCities)) {
    if (IGNORED_KEYS.includes(key) || key === 'OUTRO PAIS') continue;
    const data = allCities[key];
    if (!data || typeof data !== 'object') continue;

    const total = calculateTotalOccurrences(data);
    const cats = calculateCategoryTotals(data);
    stateTotal += total;
    stateCat.life += cats.life;
    stateCat.physical += cats.physical;
    stateCat.patrimony += cats.patrimony;

    const pop = getPopulation(key);
    if (pop && pop > 0) {
      popTotal += pop;
      popRecords += total;
      popCat.life += cats.life;
      popCat.physical += cats.physical;
      popCat.patrimony += cats.patrimony;
      rates.push({ key, rate: (total / pop) * 100000 });
    }
  }

  const share = (v: number) => (stateTotal > 0 ? (v / stateTotal) * 100 : 0);
  const benchmark: StateBenchmark = {
    stateTotal,
    stateCategoryShares: {
      life: share(stateCat.life),
      physical: share(stateCat.physical),
      patrimony: share(stateCat.patrimony),
    },
  };

  const cityPop = getPopulation(cityKey);
  const cityData = allCities[cityKey];
  if (popTotal > 0 && cityPop && cityData) {
    const per100k = (v: number, p: number) => (v / p) * 100000;
    benchmark.stateRatePer100k = per100k(popRecords, popTotal);
    benchmark.stateCategoryRates = {
      life: per100k(popCat.life, popTotal),
      physical: per100k(popCat.physical, popTotal),
      patrimony: per100k(popCat.patrimony, popTotal),
    };
    const cityCats = calculateCategoryTotals(cityData);
    benchmark.cityCategoryRates = {
      life: per100k(cityCats.life, cityPop),
      physical: per100k(cityCats.physical, cityPop),
      patrimony: per100k(cityCats.patrimony, cityPop),
    };

    rates.sort((a, b) => a.rate - b.rate);
    const idx = rates.findIndex(r => r.key === cityKey);
    if (idx >= 0 && rates.length > 1) {
      const cityRate = rates[idx].rate;
      const higher = rates.filter(r => r.rate > cityRate).length;
      benchmark.rateRank = {
        position: idx + 1,
        outOf: rates.length,
        lowerThanPct: (higher / (rates.length - 1)) * 100,
      };
    }
  }

  return benchmark;
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
