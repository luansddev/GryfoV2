/**
 * src/services/analytics/__tests__/MetricsEngine.test.ts
 * Testes unitários para o MetricsEngine, validando o isolamento entre
 * a quantidade oficial de ocorrências criminais (quantidade) e os
 * pontos georreferenciados (localizacoes).
 */

import { describe, it, expect } from '@jest/globals';
import {
  getEntryOccurrenceCount,
  calculateTotalOccurrences,
  calculateCategoryTotals,
  calculateCategoryShares,
  calculateDominantCategory,
  calculateDominantCrime,
  calculateRatePer100k,
  calculateTopCrimes,
  calculateStateBenchmark,
} from '../MetricsEngine';
import { patrimonyCrimesKeys } from '../../../constants/CrimeData';

describe('src/services/analytics/MetricsEngine.ts - Correção Metodológica', () => {
  describe('getEntryOccurrenceCount', () => {
    it('retorna a quantidade oficial quando for um número finito >= 0', () => {
      expect(getEntryOccurrenceCount({ quantidade: 100 })).toBe(100);
      expect(getEntryOccurrenceCount({ quantidade: 0 })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: 42.5 })).toBe(42.5);
    });

    it('retorna 0 quando quantidade for ausente ou undefined', () => {
      expect(getEntryOccurrenceCount({})).toBe(0);
      expect(getEntryOccurrenceCount({ localizacoes: [{ latitude: -23.55, longitude: -46.63 }] })).toBe(0);
      expect(getEntryOccurrenceCount(undefined)).toBe(0);
      expect(getEntryOccurrenceCount(null)).toBe(0);
    });

    it('retorna 0 quando quantidade for inválida (string, NaN, infinito, negativa, objeto)', () => {
      expect(getEntryOccurrenceCount({ quantidade: '100' })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: NaN })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: Infinity })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: -Infinity })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: -5 })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: null })).toBe(0);
      expect(getEntryOccurrenceCount({ quantidade: {} })).toBe(0);
    });
  });

  describe('1 & 2. Isolamento estrito entre quantidade e coordenadas', () => {
    it('Cenário 1: quando quantidade for 100 e houver apenas 70 coordenadas, retorna 100 ocorrências', () => {
      const mockLocations = Array.from({ length: 70 }, (_, i) => ({
        latitude: -23.5 + i * 0.001,
        longitude: -46.6 + i * 0.001,
      }));

      const mockData = {
        'ROUBO - OUTROS': {
          quantidade: 100,
          localizacoes: mockLocations,
        },
      };

      const total = calculateTotalOccurrences(mockData);
      expect(total).toBe(100);
    });

    it('Cenário 2: quando quantidade for 70 e houver 100 coordenadas, retorna 70 ocorrências', () => {
      const mockLocations = Array.from({ length: 100 }, (_, i) => ({
        latitude: -23.5 + i * 0.001,
        longitude: -46.6 + i * 0.001,
      }));

      const mockData = {
        'ROUBO - OUTROS': {
          quantidade: 70,
          localizacoes: mockLocations,
        },
      };

      const total = calculateTotalOccurrences(mockData);
      expect(total).toBe(70);
    });
  });

  describe('3 & 4. Ausência ou invalidade de quantidade', () => {
    it('Cenário 3: quando quantidade estiver ausente, considera 0 mesmo havendo coordenadas', () => {
      const mockData = {
        'HOMICÍDIO DOLOSO': {
          localizacoes: [
            { latitude: -23.55, longitude: -46.63 },
            { latitude: -23.56, longitude: -46.64 },
          ],
        },
        'ROUBO - OUTROS': {
          quantidade: 15,
          localizacoes: [],
        },
      };

      const total = calculateTotalOccurrences(mockData);
      expect(total).toBe(15);
    });

    it('Cenário 4: quando quantidade for inválida, considera 0', () => {
      const mockData = {
        'ESTUPRO': {
          quantidade: 'inválido' as any,
          localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
        },
        'LATROCÍNIO': {
          quantidade: -10,
          localizacoes: [{ latitude: -23.55, longitude: -46.63 }],
        },
        'ROUBO DE VEÍCULO': {
          quantidade: 5,
          localizacoes: [],
        },
      };

      const total = calculateTotalOccurrences(mockData);
      expect(total).toBe(5);
    });

    it('ignora chaves de metadados nome_da_cidade e timestamp', () => {
      const mockData = {
        nome_da_cidade: 'Campinas',
        timestamp: '2026-02-01',
        'FURTO - OUTROS': { quantidade: 30, localizacoes: [] },
      };

      expect(calculateTotalOccurrences(mockData)).toBe(30);
    });
  });

  describe('calculateCategoryTotals & calculateCategoryShares', () => {
    it('soma exclusivamente quantidades oficiais para cada categoria', () => {
      const mockData = {
        'HOMICÍDIO DOLOSO': { quantidade: 10, localizacoes: Array(25).fill({ latitude: 0, longitude: 0 }) }, // vida
        'LATROCÍNIO': { quantidade: 2, localizacoes: [] }, // vida
        'LESÃO CORPORAL DOLOSA': { quantidade: 20, localizacoes: Array(5).fill({ latitude: 0, longitude: 0 }) }, // physical
        'ROUBO - OUTROS': { quantidade: 50, localizacoes: Array(100).fill({ latitude: 0, longitude: 0 }) }, // patrimony
        'TRÁFICO DE ENTORPECENTES': { quantidade: 15, localizacoes: [] }, // não entra nas 3 macrocategorias
      };

      const totals = calculateCategoryTotals(mockData);
      expect(totals.life).toBe(12);
      expect(totals.physical).toBe(20);
      expect(totals.patrimony).toBe(50);

      const shares = calculateCategoryShares(totals, 82);
      expect(shares[0].id).toBe('patrimony');
      expect(shares[0].total).toBe(50);
      expect(shares[0].percentage).toBeCloseTo((50 / 82) * 100, 2);

      const dominant = calculateDominantCategory(shares);
      expect(dominant).toBe('patrimony');
    });
  });

  describe('5. calculateTopCrimes e calculateDominantCrime', () => {
    it('ordena o Top 5 pela quantidade oficial, não pelo número de coordenadas', () => {
      const mockData = {
        'HOMICÍDIO DOLOSO': {
          quantidade: 50,
          localizacoes: Array(5).fill({ latitude: -23.5, longitude: -46.6 }), // poucas coordenadas, alta quantidade
        },
        'ROUBO - OUTROS': {
          quantidade: 40,
          localizacoes: Array(200).fill({ latitude: -23.5, longitude: -46.6 }), // muitas coordenadas, menor quantidade
        },
        'FURTO - OUTROS': {
          quantidade: 30,
          localizacoes: [],
        },
        'ESTUPRO': {
          quantidade: 20,
          localizacoes: Array(10).fill({ latitude: -23.5, longitude: -46.6 }),
        },
        'ROUBO DE VEÍCULO': {
          quantidade: 10,
          localizacoes: Array(50).fill({ latitude: -23.5, longitude: -46.6 }),
        },
        'LATROCÍNIO': {
          quantidade: 1,
          localizacoes: [],
        },
      };

      const top5 = calculateTopCrimes(mockData, 151, 5);
      expect(top5).toHaveLength(5);
      // O 1º deve ser Homicídio Doloso (50), mesmo tendo apenas 5 coordenadas
      expect(top5[0].key).toBe('HOMICÍDIO DOLOSO');
      expect(top5[0].total).toBe(50);
      // O 2º deve ser Roubo - Outros (40), apesar de ter 200 coordenadas
      expect(top5[1].key).toBe('ROUBO - OUTROS');
      expect(top5[1].total).toBe(40);
      expect(top5[2].key).toBe('FURTO - OUTROS');
      expect(top5[2].total).toBe(30);
      expect(top5[3].key).toBe('ESTUPRO');
      expect(top5[3].total).toBe(20);
      expect(top5[4].key).toBe('ROUBO DE VEÍCULO');
      expect(top5[4].total).toBe(10);

      // Dominant Crime
      const dominant = calculateDominantCrime(mockData, 151);
      expect(dominant).toBeDefined();
      expect(dominant?.name).toBe('Homicídio Doloso');
      expect(dominant?.total).toBe(50);
    });
  });

  describe('6 & 7. calculateStateBenchmark e calculateRatePer100k', () => {
    it('Cenário 6 & 7: o benchmark estadual e as taxas por 100k utilizam as quantidades oficiais', () => {
      const mockAllCities = {
        'CIDADE_A': {
          'ROUBO - OUTROS': {
            quantidade: 200,
            localizacoes: Array(50).fill({ latitude: -23.5, longitude: -46.6 }),
          },
          'HOMICÍDIO DOLOSO': {
            quantidade: 10,
            localizacoes: [],
          },
        },
        'CIDADE_B': {
          'FURTO - OUTROS': {
            quantidade: 100,
            localizacoes: Array(300).fill({ latitude: -22.9, longitude: -47.0 }),
          },
        },
      };

      const populations: Record<string, number> = {
        'CIDADE_A': 100000,
        'CIDADE_B': 50000,
      };

      const benchmark = calculateStateBenchmark(
        mockAllCities,
        'CIDADE_A',
        (key) => populations[key]
      );

      // Total estadual oficial: Cidade A (210) + Cidade B (100) = 310
      expect(benchmark.stateTotal).toBe(310);
      // População total somada: 100.000 + 50.000 = 150.000
      // Taxa do estado: (310 / 150.000) * 100.000 = 206.666...
      expect(benchmark.stateRatePer100k).toBeCloseTo((310 / 150000) * 100000, 2);

      // Taxas da Cidade A por categoria:
      // Vida: 10 / 100.000 * 100.000 = 10
      // Patrimônio: 200 / 100.000 * 100.000 = 200
      expect(benchmark.cityCategoryRates?.life).toBe(10);
      expect(benchmark.cityCategoryRates?.patrimony).toBe(200);

      // Taxa global da cidade via calculateRatePer100k
      const cityRate = calculateRatePer100k(210, 100000);
      expect(cityRate).toBe(210);
    });
  });

  describe('8. Preservação da integridade de pontos geográficos para o mapa', () => {
    it('o array de localizacoes permanece intacto para geração de pontos GeoJSON e Supercluster', () => {
      const mockCityData: Record<string, any> = {
        'ROUBO - OUTROS': {
          quantidade: 50, // quantidade oficial
          localizacoes: [
            { latitude: -23.55052, longitude: -46.63331 },
            { latitude: -23.55211, longitude: -46.63412 },
          ],
        },
      };

      // Simula a lógica de geração de features GeoJSON utilizada no Supercluster
      const newPoints: any[] = [];
      Object.keys(mockCityData).forEach(key => {
        mockCityData[key]?.localizacoes?.forEach((loc: any, idx: number) => {
          if (
            Number.isFinite(loc.latitude) &&
            Number.isFinite(loc.longitude) &&
            Math.abs(loc.latitude) <= 90 &&
            Math.abs(loc.longitude) <= 180
          ) {
            newPoints.push({
              type: 'Feature',
              id: `${key}-${idx}`,
              geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
              properties: { crime: key },
            });
          }
        });
      });

      // 2 pontos georreferenciados foram extraídos com sucesso
      expect(newPoints).toHaveLength(2);
      expect(newPoints[0].geometry.coordinates).toEqual([-46.63331, -23.55052]);
      expect(newPoints[1].geometry.coordinates).toEqual([-46.63412, -23.55211]);

      // Ao mesmo tempo, o total de ocorrências estatístico é 50
      expect(calculateTotalOccurrences(mockCityData)).toBe(50);
    });
  });

  describe('9. Harmonização da Taxonomia Criminal - FURTO DE CARGA (Etapa 5.1B)', () => {
    it('comprova que FURTO DE CARGA está presente em patrimonyCrimesKeys', () => {
      expect(patrimonyCrimesKeys).toContain('FURTO DE CARGA');
    });

    it('contabiliza ocorrências de FURTO DE CARGA em Patrimônio via calculateCategoryTotals', () => {
      const mockData = {
        'FURTO DE CARGA': { quantidade: 32, localizacoes: [] },
      };

      const totals = calculateCategoryTotals(mockData);
      expect(totals.patrimony).toBe(32);
    });

    it('garante que FURTO DE CARGA não é contabilizado em Vida ou Integridade Física', () => {
      const mockData = {
        'FURTO DE CARGA': { quantidade: 15, localizacoes: [] },
      };

      const totals = calculateCategoryTotals(mockData);
      expect(totals.life).toBe(0);
      expect(totals.physical).toBe(0);
      expect(totals.patrimony).toBe(15);
    });

    it('calcula corretamente a participação percentual de Patrimônio incluindo FURTO DE CARGA', () => {
      const mockData = {
        'HOMICÍDIO DOLOSO': { quantidade: 10, localizacoes: [] }, // life
        'LESÃO CORPORAL DOLOSA': { quantidade: 20, localizacoes: [] }, // physical
        'ROUBO - OUTROS': { quantidade: 40, localizacoes: [] }, // patrimony
        'FURTO DE CARGA': { quantidade: 10, localizacoes: [] }, // patrimony (adicionado)
        'TRÁFICO DE ENTORPECENTES': { quantidade: 20, localizacoes: [] }, // other
      };

      const totalOccurrences = calculateTotalOccurrences(mockData);
      expect(totalOccurrences).toBe(100);

      const totals = calculateCategoryTotals(mockData);
      expect(totals.patrimony).toBe(50); // 40 + 10

      const shares = calculateCategoryShares(totals, totalOccurrences);
      const patrimonyShare = shares.find(s => s.id === 'patrimony');
      expect(patrimonyShare?.total).toBe(50);
      expect(patrimonyShare?.percentage).toBe(50);
    });

    it('garante que o resíduo de Outros deixa de incluir FURTO DE CARGA', () => {
      const mockData = {
        'HOMICÍDIO DOLOSO': { quantidade: 5, localizacoes: [] }, // life = 5
        'LESÃO CORPORAL DOLOSA': { quantidade: 15, localizacoes: [] }, // physical = 15
        'ROUBO - OUTROS': { quantidade: 30, localizacoes: [] }, // patrimony = 30
        'FURTO DE CARGA': { quantidade: 10, localizacoes: [] }, // agora patrimony (+10 => 40)
        'TRÁFICO DE ENTORPECENTES': { quantidade: 20, localizacoes: [] }, // outros legítimo = 20
        'PORTE DE ARMA': { quantidade: 5, localizacoes: [] }, // outros legítimo = 5
      };

      const totalOccurrences = calculateTotalOccurrences(mockData);
      expect(totalOccurrences).toBe(85);

      const totals = calculateCategoryTotals(mockData);
      expect(totals.life).toBe(5);
      expect(totals.physical).toBe(15);
      expect(totals.patrimony).toBe(40); // 30 + 10

      // Regra de cálculo de otherTotal existente no projeto (useCrimeAnalysis.ts):
      // Math.max(0, totalOccurrences - categoryTotals.life - categoryTotals.physical - categoryTotals.patrimony)
      const otherTotal = Math.max(
        0,
        totalOccurrences - totals.life - totals.physical - totals.patrimony
      );

      // otherTotal deve ser exatamente 25 (20 tráfico + 5 porte de arma), excluindo os 10 de furto de carga
      expect(otherTotal).toBe(25);
    });
  });
});

