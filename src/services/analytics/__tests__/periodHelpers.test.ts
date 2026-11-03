/**
 * src/services/analytics/__tests__/periodHelpers.test.ts
 * Testes unitários para utilitários de formatação e parsing de períodos.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_COMPATIBILITY_PERIOD,
  formatPeriodLongName,
  formatPeriodShortName,
  formatPeriodStatusLabel,
  isPeriodClassificationConfirmed,
  parsePeriodParams,
  reconcilePeriodClassification,
} from '../periodHelpers';

describe('src/services/analytics/periodHelpers.ts', () => {
  describe('formatPeriodLongName', () => {
    it('formata corretamente meses conhecidos', () => {
      expect(formatPeriodLongName(7, 2026)).toBe('Julho de 2026');
      expect(formatPeriodLongName(2, 2026)).toBe('Fevereiro de 2026');
      expect(formatPeriodLongName(1, 2025)).toBe('Janeiro de 2025');
      expect(formatPeriodLongName(12, 2024)).toBe('Dezembro de 2024');
    });

    it('trata mês fora do padrão', () => {
      expect(formatPeriodLongName(13, 2026)).toBe('Mês 13 de 2026');
    });
  });

  describe('formatPeriodShortName', () => {
    it('formata abreviações de período', () => {
      expect(formatPeriodShortName(7, 2026)).toBe('Jul/26');
      expect(formatPeriodShortName(2, 2026)).toBe('Fev/26');
      expect(formatPeriodShortName(10, 2025)).toBe('Out/25');
    });
  });

  describe('formatPeriodStatusLabel', () => {
    it('retorna os rótulos de tipo corretos e null para classificação desconhecida', () => {
      expect(formatPeriodStatusLabel('active')).toBe('Período ativo');
      expect(formatPeriodStatusLabel('compatibility')).toBe('Compatibilidade');
      expect(formatPeriodStatusLabel('unknown')).toBeNull();
      expect(formatPeriodStatusLabel(undefined)).toBeNull();
    });
  });

  describe('parsePeriodParams', () => {
    it('faz parse correto de parâmetros válidos para período ativo', () => {
      const res = parsePeriodParams('2026', '7', 'active');
      expect(res.year).toBe(2026);
      expect(res.month).toBe(7);
      expect(res.period).toBe('2026-07');
      expect(res.type).toBe('active');
      expect(res.isCompatibilityFixture).toBe(false);
    });

    it('faz parse correto de parâmetros válidos para compatibilidade', () => {
      const res = parsePeriodParams('2026', '2', 'compatibility');
      expect(res.year).toBe(2026);
      expect(res.month).toBe(2);
      expect(res.period).toBe('2026-02');
      expect(res.type).toBe('compatibility');
      expect(res.isCompatibilityFixture).toBe(true);
    });

    it('retorna o padrão de compatibilidade quando parâmetros estão ausentes', () => {
      expect(parsePeriodParams(undefined, undefined)).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsePeriodParams('2026', undefined)).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsePeriodParams(undefined, '7')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
    });

    it('retorna o padrão de compatibilidade para valores não numéricos', () => {
      expect(parsePeriodParams('abc', '7')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsePeriodParams('2026', 'xyz')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
    });

    it('retorna o padrão de compatibilidade para mês fora do intervalo [1, 12]', () => {
      expect(parsePeriodParams('2026', '0')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsePeriodParams('2026', '13')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
    });

    it('retorna o padrão de compatibilidade para ano fora do intervalo aceitável', () => {
      expect(parsePeriodParams('1990', '7')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsePeriodParams('2150', '7')).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
    });

    it('lida com arrays retornados por query params do Expo Router', () => {
      const res = parsePeriodParams(['2026'], ['7'], ['active']);
      expect(res.year).toBe(2026);
      expect(res.month).toBe(7);
      expect(res.type).toBe('active');
    });

    it('rejeita type=active para fevereiro de 2026 e retorna incondicionalmente compatibilidade', () => {
      const res = parsePeriodParams('2026', '2', 'active');
      expect(res).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(res.type).toBe('compatibility');
      expect(res.isCompatibilityFixture).toBe(true);
    });

    it('utiliza catálogo para validar se período é ativo quando catálogo for fornecido', () => {
      const catalog = [
        { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false },
        DEFAULT_COMPATIBILITY_PERIOD,
      ];

      // Julho no catálogo com active:
      const resJul = parsePeriodParams('2026', '7', 'active', catalog);
      expect(resJul.type).toBe('active');
      expect(resJul.isCompatibilityFixture).toBe(false);

      // Período não catalogado com type=active não vira fixture, vira unknown:
      const resDesconhecido = parsePeriodParams('2025', '1', 'active', catalog);
      expect(resDesconhecido.type).toBe('unknown');
      expect(resDesconhecido.isCompatibilityFixture).toBe(false);
    });
  });

  describe('reconcilePeriodClassification', () => {
    const catalog = [
      { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false },
      DEFAULT_COMPATIBILITY_PERIOD,
    ];

    it('sempre classifica fevereiro de 2026 como compatibilidade, mesmo se fornecido com type active', () => {
      const input = { year: 2026, month: 2, period: '2026-02', type: 'active' as const, isCompatibilityFixture: false };
      const reconciled = reconcilePeriodClassification(input, catalog);
      expect(reconciled.type).toBe('compatibility');
      expect(reconciled.isCompatibilityFixture).toBe(true);
    });

    it('confirma classificação de período ativo quando presente no catálogo', () => {
      const input = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      const reconciled = reconcilePeriodClassification(input, catalog);
      expect(reconciled.type).toBe('active');
      expect(reconciled.isCompatibilityFixture).toBe(false);
    });

    it('reconcilia período ativo com classificação incompatível (ex: compatibility) para active', () => {
      const input = { year: 2026, month: 7, period: '2026-07', type: 'compatibility' as const, isCompatibilityFixture: true };
      const reconciled = reconcilePeriodClassification(input, catalog);
      expect(reconciled.type).toBe('active');
      expect(reconciled.isCompatibilityFixture).toBe(false);
    });

    it('julho de 2026 não é classificado como fixture quando o catálogo contém somente fevereiro', () => {
      const catalogOnlyFeb = [DEFAULT_COMPATIBILITY_PERIOD];
      const inputJul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      const reconciled = reconcilePeriodClassification(inputJul, catalogOnlyFeb);
      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
    });

    it('período inexistente ou desconhecido não recebe isCompatibilityFixture = true', () => {
      const input = { year: 2025, month: 1, period: '2025-01', type: 'active' as const, isCompatibilityFixture: false };
      const reconciled = reconcilePeriodClassification(input, catalog);
      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
    });

    it('catálogo vazio [] não permite preservar indevidamente type=active e resulta em unknown', () => {
      const inputJul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      const reconciled = reconcilePeriodClassification(inputJul, []);
      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
    });

    it('catálogo ainda não carregado (undefined) é tratado de maneira diferente de catálogo carregado e vazio []', () => {
      const inputJul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      const resUndefined = reconcilePeriodClassification(inputJul, undefined);
      const resEmpty = reconcilePeriodClassification(inputJul, []);

      // undefined mantém o tipo provisório da rota antes da resolução da rede
      expect(resUndefined.type).toBe('active');
      expect(resUndefined.isCompatibilityFixture).toBe(false);

      // [] representa consulta concluída sem períodos disponíveis: rejeita active e marca unknown
      expect(resEmpty.type).toBe('unknown');
      expect(resEmpty.isCompatibilityFixture).toBe(false);

      expect(resUndefined.type).not.toBe(resEmpty.type);
    });
  });

  describe('isPeriodClassificationConfirmed', () => {
    const catalog = [
      { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false },
      DEFAULT_COMPATIBILITY_PERIOD,
    ];

    it('confirma incondicionalmente fevereiro de 2026 mesmo sem catálogo (undefined) ou catálogo vazio ([])', () => {
      const feb = { year: 2026, month: 2, period: '2026-02', type: 'compatibility' as const, isCompatibilityFixture: true };
      expect(isPeriodClassificationConfirmed(feb, undefined)).toBe(true);
      expect(isPeriodClassificationConfirmed(feb, [])).toBe(true);
      expect(isPeriodClassificationConfirmed(feb, catalog)).toBe(true);
    });

    it('não confirma julho de 2026 enquanto o catálogo estiver indefinido (carregando)', () => {
      const jul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      expect(isPeriodClassificationConfirmed(jul, undefined)).toBe(false);
    });

    it('não confirma julho de 2026 quando o catálogo for vazio ([])', () => {
      const jul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      expect(isPeriodClassificationConfirmed(jul, [])).toBe(false);
    });

    it('confirma julho de 2026 quando presente e classificado no catálogo', () => {
      const jul = { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false };
      expect(isPeriodClassificationConfirmed(jul, catalog)).toBe(true);
    });

    it('não confirma período ausente do catálogo', () => {
      const unknownPeriod = { year: 2025, month: 5, period: '2025-05', type: 'active' as const, isCompatibilityFixture: false };
      expect(isPeriodClassificationConfirmed(unknownPeriod, catalog)).toBe(false);
    });
  });
});

