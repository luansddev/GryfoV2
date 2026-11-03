/**
 * src/services/analytics/periodHelpers.ts
 * Utilitários centralizados para formatação, validação e manipulação de períodos criminais.
 */

import { CrimePeriodInfo, CrimePeriodType } from './CrimeHistoryService';

export const DEFAULT_COMPATIBILITY_PERIOD: CrimePeriodInfo = {
  year: 2026,
  month: 2,
  period: '2026-02',
  type: 'compatibility',
  isCompatibilityFixture: true,
  metadata: {
    source: 'firebase_static',
    dataset_id: 'ssp_sp_legacy_fixture',
  },
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Retorna o nome longo do período (ex: "Julho de 2026" ou "Fevereiro de 2026").
 */
export function formatPeriodLongName(month: number, year: number): string {
  const m = MONTH_NAMES[month - 1] ?? `Mês ${month}`;
  return `${m} de ${year}`;
}

/**
 * Retorna o nome curto do período (ex: "Jul/26" ou "Fev/26").
 */
export function formatPeriodShortName(month: number, year: number): string {
  const m = (MONTH_NAMES[month - 1] ?? '').slice(0, 3);
  const yy = String(year).slice(-2);
  return `${m}/${yy}`;
}

/**
 * Retorna o rótulo de status do período (ex: "Período ativo" ou "Compatibilidade").
 * Retorna null quando a classificação for 'unknown' ou indefinida, evitando exibir badge incorreto.
 */
export function formatPeriodStatusLabel(type?: CrimePeriodType): string | null {
  if (type === 'active') return 'Período ativo';
  if (type === 'compatibility') return 'Compatibilidade';
  return null;
}

/**
 * Valida e converte parâmetros de rota (strings) para um objeto de período tipado e seguro.
 * Se os parâmetros forem inválidos, omitidos ou fora do intervalo, retorna o padrão seguro (Fevereiro de 2026).
 * Se o catálogo for fornecido (inclusive vazio []), valida a classificação canônica do período.
 * Fevereiro de 2026 é SEMPRE classificado como 'compatibility', mesmo que type='active' seja informado na rota.
 */
export function parsePeriodParams(
  yearParam?: string | string[],
  monthParam?: string | string[],
  typeParam?: string | string[],
  catalog?: CrimePeriodInfo[]
): CrimePeriodInfo {
  const yStr = Array.isArray(yearParam) ? yearParam[0] : yearParam;
  const mStr = Array.isArray(monthParam) ? monthParam[0] : monthParam;
  const tStr = Array.isArray(typeParam) ? typeParam[0] : typeParam;

  if (!yStr || !mStr) {
    return DEFAULT_COMPATIBILITY_PERIOD;
  }

  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  if (isNaN(year) || isNaN(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return DEFAULT_COMPATIBILITY_PERIOD;
  }

  // Regra canônica: Fevereiro de 2026 é incondicionalmente compatibilidade
  if (year === 2026 && month === 2) {
    return DEFAULT_COMPATIBILITY_PERIOD;
  }

  const monthFormatted = month.toString().padStart(2, '0');
  const period = `${year}-${monthFormatted}`;

  // Se o catálogo foi fornecido (inclusive vazio []), delega diretamente para a reconciliação canônica
  if (catalog !== undefined) {
    const initialType: CrimePeriodType =
      tStr === 'active' ? 'active' : tStr === 'compatibility' ? 'compatibility' : 'unknown';
    return reconcilePeriodClassification(
      {
        year,
        month,
        period,
        type: initialType,
        isCompatibilityFixture: false,
      },
      catalog
    );
  }

  // Sem catálogo (catalog === undefined): cria objeto provisório sem confirmar como fixture
  const type: CrimePeriodType =
    tStr === 'active' ? 'active' : tStr === 'compatibility' ? 'compatibility' : 'unknown';

  return {
    year,
    month,
    period,
    type,
    isCompatibilityFixture: false,
  };
}

/**
 * Determina se a classificação de um período é canonicamente confirmada.
 * - Fevereiro de 2026 é sempre confirmado por ser o fixture estático conhecido.
 * - Para outros períodos, requer catálogo oficial com correspondência válida.
 * - Catálogo não carregado (undefined) ou vazio ([]) não confirma o período.
 */
export function isPeriodClassificationConfirmed(
  period: CrimePeriodInfo,
  catalog?: CrimePeriodInfo[]
): boolean {
  if (period.year === 2026 && period.month === 2) return true;
  if (!catalog || catalog.length === 0) return false;
  const match = catalog.find((c) => c.year === period.year && c.month === period.month);
  if (!match) return false;
  return match.type === 'active' || (match.type === 'compatibility' && match.isCompatibilityFixture);
}
/**
 * Reconcilia a classificação de um período com o catálogo oficial de períodos.
 * - Fevereiro de 2026 é canonicamente estrito como 'compatibility'.
 * - Um período é classificado como 'active' somente se confirmado pelo catálogo como ativo oficial.
 * - Um período é classificado como 'compatibility' somente se identificado como fixture no catálogo ou for fev/2026.
 * - Período não encontrado no catálogo não recebe 'isCompatibilityFixture: true'.
 * - Um catálogo vazio [] é tratado como consulta concluída sem períodos, diferente de catálogo não carregado (undefined).
 */
export function reconcilePeriodClassification(
  period: CrimePeriodInfo,
  catalog?: CrimePeriodInfo[]
): CrimePeriodInfo {
  // Regra canônica 1: Fevereiro de 2026 é incondicionalmente compatibilidade
  if (period.year === 2026 && period.month === 2) {
    return DEFAULT_COMPATIBILITY_PERIOD;
  }

  // Regra canônica 2: Catálogo ausente / ainda não carregado (undefined)
  // Diferenciação semântica obrigatória: undefined != []
  if (catalog === undefined) {
    return {
      ...period,
      isCompatibilityFixture: period.year === 2026 && period.month === 2,
    };
  }

  // Regra canônica 3: Catálogo carregado (é um array, inclusive vazio [])
  const match = catalog.find((c) => c.year === period.year && c.month === period.month);

  // 3a. Confirmado ativo no catálogo
  if (match && match.type === 'active' && !match.isCompatibilityFixture) {
    return {
      ...period,
      type: 'active',
      isCompatibilityFixture: false,
      total_occurrences: match.total_occurrences,
      total_municipalities: match.total_municipalities,
      metadata: match.metadata,
    };
  }

  // 3b. Confirmado como fixture de compatibilidade no catálogo
  if (match && match.type === 'compatibility' && match.isCompatibilityFixture) {
    return {
      ...period,
      type: 'compatibility',
      isCompatibilityFixture: true,
      metadata: match.metadata,
    };
  }

  // 3c. Não encontrado no catálogo (ou catálogo vazio [])
  // Não pode ser ativo, não é fixture conhecido, não recebe isCompatibilityFixture: true
  return {
    ...period,
    type: 'unknown',
    isCompatibilityFixture: false,
  };
}

