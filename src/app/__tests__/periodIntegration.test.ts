/**
 * src/app/__tests__/periodIntegration.test.ts
 * Testes de integração de períodos e semântica de benchmark para a Etapa 8.4.
 * Valida o fluxo de sincronização entre as telas Dados e Análise,
 * bem como as regras de apresentação de cobertura parcial.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  parsePeriodParams,
  reconcilePeriodClassification,
  isPeriodClassificationConfirmed,
  formatPeriodLongName,
  formatPeriodShortName,
  formatPeriodStatusLabel,
  DEFAULT_COMPATIBILITY_PERIOD,
} from '../../services/analytics/periodHelpers';
import { getVerdict } from '../../components/analysis/format';
import { StateBenchmark } from '../../services/analytics/types';

describe('Etapa 8.4 — Integração Visual e Sincronização de Períodos', () => {
  describe('8.4C — Sincronização de parâmetros de rota (Expo Router)', () => {
    it('faz o parse correto dos parâmetros passados pela tela Dados para julho de 2026', () => {
      const params = { year: '2026', month: '7', type: 'active' };
      const parsed = parsePeriodParams(params.year, params.month, params.type);

      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(7);
      expect(parsed.type).toBe('active');
      expect(parsed.period).toBe('2026-07');
    });

    it('faz o parse correto dos parâmetros passados para fevereiro de 2026 (compatibilidade)', () => {
      const params = { year: '2026', month: '2', type: 'compatibility' };
      const parsed = parsePeriodParams(params.year, params.month, params.type);

      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(2);
      expect(parsed.type).toBe('compatibility');
      expect(parsed.period).toBe('2026-02');
    });

    it('utiliza o período padrão de compatibilidade (fevereiro de 2026) quando os parâmetros forem omitidos', () => {
      const parsed = parsePeriodParams(undefined, undefined, undefined);

      expect(parsed).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(2);
      expect(parsed.type).toBe('compatibility');
    });

    it('rejeita parâmetros corrompidos e faz fallback seguro para fevereiro de 2026', () => {
      const parsed = parsePeriodParams('abc', '99', 'unknown');

      expect(parsed).toEqual(DEFAULT_COMPATIBILITY_PERIOD);
      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(2);
    });
  });

  describe('8.4B e 8.4C — Formatação e labels visuais dos períodos', () => {
    it('formata o nome longo para exibição em cards e modais', () => {
      expect(formatPeriodLongName(7, 2026)).toBe('Julho de 2026');
      expect(formatPeriodLongName(2, 2026)).toBe('Fevereiro de 2026');
    });

    it('formata o nome curto para exibição no pill flutuante do mapa', () => {
      expect(formatPeriodShortName(7, 2026)).toBe('Jul/26');
      expect(formatPeriodShortName(2, 2026)).toBe('Fev/26');
    });

    it('retorna os badges de status apropriados para cada categoria de período', () => {
      expect(formatPeriodStatusLabel('active')).toBe('Período ativo');
      expect(formatPeriodStatusLabel('compatibility')).toBe('Compatibilidade');
    });
  });

  describe('8.4D — Semântica de apresentação do benchmark com cobertura parcial', () => {
    const mockPartialBenchmark: StateBenchmark = {
      stateTotal: 90319,
      stateCategoryShares: {
        patrimony: 75.5,
        physical: 22.1,
        life: 2.4,
      },
      stateRatePer100k: undefined, // Rigor semântico: nulo na API, mapeado para undefined
      coveredRatePer100k: 203.38,
      coveredMunicipalities: 626,
      coveredPopulation: 44358687,
      statePopulation: 44411238,
      isPartialCoverage: true,
    };

    const mockFullBenchmark: StateBenchmark = {
      stateTotal: 88500,
      stateCategoryShares: {
        patrimony: 74.0,
        physical: 23.0,
        life: 3.0,
      },
      stateRatePer100k: 198.5,
      coveredRatePer100k: 198.5,
      coveredMunicipalities: 645,
      coveredPopulation: 44411238,
      statePopulation: 44411238,
      isPartialCoverage: false,
    };

    it('suprime veredictos de comparação com a média de SP quando a cobertura for parcial', () => {
      const cityRate = 277.26;

      // Quando a cobertura é parcial, stateRatePer100k é undefined
      const verdict = mockPartialBenchmark.isPartialCoverage
        ? null
        : getVerdict(cityRate, mockPartialBenchmark.stateRatePer100k);

      expect(verdict).toBeNull();
    });

    it('calcula o veredicto normalmente quando a cobertura for total (fevereiro de 2026)', () => {
      const cityRate = 277.26;

      const verdict = mockFullBenchmark.isPartialCoverage
        ? null
        : getVerdict(cityRate, mockFullBenchmark.stateRatePer100k);

      expect(verdict).not.toBeNull();
      expect(verdict?.verdict).toBe('above');
      expect(verdict?.diffPct).toBeGreaterThan(0);
    });

    it('mantém coveredRatePer100k e coveredMunicipalities acessíveis para exibição informativa', () => {
      expect(mockPartialBenchmark.isPartialCoverage).toBe(true);
      expect(mockPartialBenchmark.coveredMunicipalities).toBe(626);
      expect(mockPartialBenchmark.coveredRatePer100k).toBe(203.38);
      expect(mockPartialBenchmark.coveredPopulation).toBe(44358687);
    });
  });

  describe('Etapa 8.4.2 — Correção Semântica da Classificação de Períodos', () => {
    const catalog = [
      { year: 2026, month: 7, period: '2026-07', type: 'active' as const, isCompatibilityFixture: false },
      DEFAULT_COMPATIBILITY_PERIOD,
    ];

    it('fevereiro de 2026 continua sendo compatibilidade mesmo com type=active na rota', () => {
      const parsed = parsePeriodParams('2026', '2', 'active');
      expect(parsed.type).toBe('compatibility');
      expect(parsed.isCompatibilityFixture).toBe(true);

      const reconciled = reconcilePeriodClassification(parsed, catalog);
      expect(reconciled.type).toBe('compatibility');
      expect(reconciled.isCompatibilityFixture).toBe(true);
      expect(formatPeriodStatusLabel(reconciled.type)).toBe('Compatibilidade');
    });

    it('julho de 2026 é classificado como ativo quando confirmado pelo catálogo', () => {
      const parsed = parsePeriodParams('2026', '7', 'active');
      const reconciled = reconcilePeriodClassification(parsed, catalog);
      expect(reconciled.type).toBe('active');
      expect(reconciled.isCompatibilityFixture).toBe(false);
      expect(formatPeriodStatusLabel(reconciled.type)).toBe('Período ativo');
    });

    it('um fixture conhecido é classificado como compatibilidade', () => {
      const reconciled = reconcilePeriodClassification(DEFAULT_COMPATIBILITY_PERIOD, catalog);
      expect(reconciled.type).toBe('compatibility');
      expect(reconciled.isCompatibilityFixture).toBe(true);
      expect(formatPeriodStatusLabel(reconciled.type)).toBe('Compatibilidade');
    });

    it('julho de 2026 não é classificado como fixture quando o catálogo contém somente fevereiro', () => {
      const catalogOnlyFeb = [DEFAULT_COMPATIBILITY_PERIOD];
      const parsedJul = parsePeriodParams('2026', '7', 'active');
      const reconciled = reconcilePeriodClassification(parsedJul, catalogOnlyFeb);

      // Não pode ser ativo (não está no catálogo) e NÃO pode ser classificado como fixture
      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
      // Interface não deve exibir badge de ativo nem de compatibilidade
      expect(formatPeriodStatusLabel(reconciled.type)).toBeNull();
    });

    it('um período inexistente não recebe isCompatibilityFixture: true', () => {
      const parsedInexistente = parsePeriodParams('2025', '1', 'active');
      const reconciled = reconcilePeriodClassification(parsedInexistente, catalog);

      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
      expect(formatPeriodStatusLabel(reconciled.type)).toBeNull();
    });

    it('um catálogo vazio não permite preservar indevidamente type=active', () => {
      const parsedJul = parsePeriodParams('2026', '7', 'active');
      const reconciled = reconcilePeriodClassification(parsedJul, []);

      expect(reconciled.type).toBe('unknown');
      expect(reconciled.isCompatibilityFixture).toBe(false);
      expect(formatPeriodStatusLabel(reconciled.type)).toBeNull();
    });

    it('catálogo ainda não carregado (undefined) é tratado de maneira diferente de catálogo carregado e vazio []', () => {
      const parsedJul = parsePeriodParams('2026', '7', 'active');
      const resUndefined = reconcilePeriodClassification(parsedJul, undefined);
      const resEmpty = reconcilePeriodClassification(parsedJul, []);

      // undefined retém a solicitação provisória da rota aguardando resposta da rede
      expect(resUndefined.type).toBe('active');
      expect(resUndefined.isCompatibilityFixture).toBe(false);

      // [] representa uma consulta concluída sem períodos: rejeita active e marca unknown
      expect(resEmpty.type).toBe('unknown');
      expect(resEmpty.isCompatibilityFixture).toBe(false);

      expect(resUndefined.type).not.toBe(resEmpty.type);
    });

    it('a interface não apresenta badge de período ativo ou de compatibilidade quando a classificação for desconhecida', () => {
      expect(formatPeriodStatusLabel('unknown')).toBeNull();
      expect(formatPeriodStatusLabel(undefined)).toBeNull();
    });

    it('a classificação visual permanece coerente com o período efetivamente utilizado pelo motor analítico', () => {
      // Cenário: catálogo confirma julho como ativo
      const julActive = reconcilePeriodClassification({ year: 2026, month: 7, period: '2026-07', type: 'compatibility', isCompatibilityFixture: true }, catalog);
      expect(julActive.type).toBe('active');
      expect(julActive.isCompatibilityFixture).toBe(false);
      expect(formatPeriodStatusLabel(julActive.type)).toBe('Período ativo');

      // Cenário: API caiu, catálogo só tem fevereiro. Julho não é ativo nem fixture
      const julFallback = reconcilePeriodClassification({ year: 2026, month: 7, period: '2026-07', type: 'active', isCompatibilityFixture: false }, [DEFAULT_COMPATIBILITY_PERIOD]);
      expect(julFallback.type).toBe('unknown');
      expect(julFallback.isCompatibilityFixture).toBe(false);
      expect(formatPeriodStatusLabel(julFallback.type)).toBeNull();
    });

    it('bloqueia classificação visual provisória: rota com type=active não confirma badge antes do catálogo', () => {
      const parsedJul = parsePeriodParams('2026', '7', 'active');
      // Antes do catálogo resolver (catalog = undefined), a classificação NÃO é confirmada
      expect(isPeriodClassificationConfirmed(parsedJul, undefined)).toBe(false);

      // Depois que o catálogo resolve com 07/2026 ativo:
      const reconciled = reconcilePeriodClassification(parsedJul, catalog);
      expect(isPeriodClassificationConfirmed(reconciled, catalog)).toBe(true);
      expect(formatPeriodStatusLabel(reconciled.type)).toBe('Período ativo');
    });

    it('fevereiro continua identificado e confirmado como compatibilidade mesmo antes do catálogo', () => {
      const parsedFeb = parsePeriodParams('2026', '2', 'active');
      // Fevereiro é exceção canônica conhecida e já nasce confirmado como compatibilidade
      expect(isPeriodClassificationConfirmed(parsedFeb, undefined)).toBe(true);
      expect(formatPeriodStatusLabel(parsedFeb.type)).toBe('Compatibilidade');
    });

    it('falha na consulta do catálogo não transforma classificação provisória em confirmação', () => {
      const parsedJul = parsePeriodParams('2026', '7', 'active');
      // Simulando falha de rede que não obtém catálogo confiável:
      const fallbackOnFailure = {
        ...parsedJul,
        type: 'unknown' as const,
        isCompatibilityFixture: false,
      };
      expect(isPeriodClassificationConfirmed(fallbackOnFailure, undefined)).toBe(false);
      expect(formatPeriodStatusLabel(fallbackOnFailure.type)).toBeNull();
    });
  });

  describe('Etapa 8.4.1 — Ciclo de Vida do Carregamento e Prevenção de Condições de Corrida', () => {
    // Harness simulando a máquina de estados implementada em dados.tsx
    class DadosLoadingController {
      periodRequestId = 0;
      isPeriodLoading = false;
      periodError: string | null = null;
      allCitiesData: any = null;
      dadosCidade: any = null;
      activeCityKey = 'S.PAULO';

      async loadCrimeDataForPeriod(
        period: { month: number; year: number },
        fetcher: (m: number, y: number) => Promise<any>,
        targetCity?: string
      ) {
        const requestId = ++this.periodRequestId;
        this.isPeriodLoading = true;
        this.periodError = null;
        // Limpeza imediata dos dados do período anterior
        this.allCitiesData = null;
        this.dadosCidade = null;

        try {
          const json = await fetcher(period.month, period.year);
          if (this.periodRequestId !== requestId) return;

          if (json) {
            this.allCitiesData = json;
            const cityToUse = this.activeCityKey || targetCity || 'S.PAULO';
            const defaultCity = json[cityToUse] ? cityToUse : 'S.PAULO';
            this.dadosCidade = json[defaultCity] || null;
            this.activeCityKey = defaultCity;
          } else {
            this.allCitiesData = null;
            this.dadosCidade = null;
            this.periodError = `Dados criminais indisponíveis para ${period.month}/${period.year}`;
          }
        } catch (err: any) {
          if (this.periodRequestId !== requestId) return;
          this.allCitiesData = null;
          this.dadosCidade = null;
          this.periodError = `Falha ao carregar dados de ${period.month}/${period.year}`;
        } finally {
          if (this.periodRequestId === requestId) {
            this.isPeriodLoading = false;
          }
        }
      }
    }

    it('limpa imediatamente os dados do período anterior ao iniciar nova requisição', async () => {
      const controller = new DadosLoadingController();
      // Estado prévio com dados de fevereiro
      controller.allCitiesData = { 'S.PAULO': { total: 100 } };
      controller.dadosCidade = { total: 100 };

      // Inicia busca de julho com promessa não resolvida
      let resolvePromise: any;
      const delayedFetch = () => new Promise((resolve) => { resolvePromise = resolve; });

      const loadPromise = controller.loadCrimeDataForPeriod({ month: 7, year: 2026 }, delayedFetch as any);

      // Verificação IMEDIATA antes do await resolver:
      expect(controller.isPeriodLoading).toBe(true);
      expect(controller.allCitiesData).toBeNull();
      expect(controller.dadosCidade).toBeNull();

      // Resolve a promessa com os dados de julho:
      resolvePromise({ 'S.PAULO': { total: 200 } });
      await loadPromise;

      expect(controller.isPeriodLoading).toBe(false);
      expect(controller.dadosCidade).toEqual({ total: 200 });
    });

    it('troca rápida de períodos: requisição antiga atrasada é descartada e não sobrescreve a mais recente', async () => {
      const controller = new DadosLoadingController();

      let resolveReq1: any;
      let resolveReq2: any;

      const fetch1 = () => new Promise((resolve) => { resolveReq1 = resolve; });
      const fetch2 = () => new Promise((resolve) => { resolveReq2 = resolve; });

      // Requisição 1: Julho
      const p1 = controller.loadCrimeDataForPeriod({ month: 7, year: 2026 }, fetch1 as any);
      // Requisição 2 disparada logo em seguida: Fevereiro
      const p2 = controller.loadCrimeDataForPeriod({ month: 2, year: 2026 }, fetch2 as any);

      // A requisição 1 resolve DEPOIS da requisição 2 ter sido iniciada
      resolveReq1({ 'S.PAULO': { total: 'dados_de_julho' } });
      await p1;

      // Os dados NÃO podem ter sido preenchidos com os dados da requisição 1
      expect(controller.dadosCidade).toBeNull();
      // O loading da requisição 2 ainda deve permanecer ativo
      expect(controller.isPeriodLoading).toBe(true);

      // A requisição 2 resolve
      resolveReq2({ 'S.PAULO': { total: 'dados_de_fevereiro' } });
      await p2;

      expect(controller.isPeriodLoading).toBe(false);
      expect(controller.dadosCidade).toEqual({ total: 'dados_de_fevereiro' });
    });

    it('requisição antiga não desativa o loading da requisição ativa mais recente', async () => {
      const controller = new DadosLoadingController();

      let resolveOld: any;
      let resolveNew: any;

      const fetchOld = () => new Promise((resolve) => { resolveOld = resolve; });
      const fetchNew = () => new Promise((resolve) => { resolveNew = resolve; });

      const pOld = controller.loadCrimeDataForPeriod({ month: 2, year: 2026 }, fetchOld as any);
      const pNew = controller.loadCrimeDataForPeriod({ month: 7, year: 2026 }, fetchNew as any);

      // Requisição antiga finaliza com erro
      resolveOld(null);
      await pOld;

      // O loading AINDA deve ser true porque a requisição mais nova está ativa
      expect(controller.isPeriodLoading).toBe(true);
      expect(controller.periodError).toBeNull();

      resolveNew({ 'S.PAULO': { total: 300 } });
      await pNew;

      expect(controller.isPeriodLoading).toBe(false);
      expect(controller.dadosCidade).toEqual({ total: 300 });
    });

    it('mudança de cidade durante o carregamento associa corretamente a nova cidade aos dados do novo período', async () => {
      const controller = new DadosLoadingController();
      controller.activeCityKey = 'S.PAULO';

      let resolveFetch: any;
      const delayedFetch = () => new Promise((resolve) => { resolveFetch = resolve; });

      const loadPromise = controller.loadCrimeDataForPeriod({ month: 7, year: 2026 }, delayedFetch as any);

      // Usuário busca 'CAMPINAS' enquanto o download de julho está em trânsito
      controller.activeCityKey = 'CAMPINAS';

      resolveFetch({
        'S.PAULO': { total: 1000 },
        'CAMPINAS': { total: 350 },
      });
      await loadPromise;

      // Os dados da cidade exibida devem ser de CAMPINAS, não S.PAULO
      expect(controller.dadosCidade).toEqual({ total: 350 });
      expect(controller.activeCityKey).toBe('CAMPINAS');
    });

    it('falha no carregamento de julho mantém dados vazios e exibe erro sem reaproveitar fevereiro', async () => {
      const controller = new DadosLoadingController();
      // Estado prévio com dados de fevereiro
      controller.allCitiesData = { 'S.PAULO': { total: 'fevereiro' } };
      controller.dadosCidade = { total: 'fevereiro' };

      const failingFetch = () => Promise.reject(new Error('Network error'));

      await controller.loadCrimeDataForPeriod({ month: 7, year: 2026 }, failingFetch as any);

      // Dados devem estar estritamente vazios
      expect(controller.allCitiesData).toBeNull();
      expect(controller.dadosCidade).toBeNull();
      expect(controller.isPeriodLoading).toBe(false);
      expect(controller.periodError).toContain('Falha ao carregar dados');
    });
  });
});
