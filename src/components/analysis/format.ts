import { CrimeCategory } from '../../services/analytics/types';

/** 12345 -> "12.345" */
export const fmtInt = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 12.345 -> "12,3" */
export const fmtDec = (n: number, digits = 1) => {
  const [int, dec] = n.toFixed(digits).split('.');
  return dec ? `${fmtInt(Number(int))},${dec}` : fmtInt(Number(int));
};

/** Taxas: abaixo de 100 mostra uma casa decimal, acima arredonda */
export const fmtRate = (n: number) => (n >= 100 ? fmtInt(n) : fmtDec(n, 1));

/** 11451245 -> "11,5 milhões" | 312000 -> "312 mil" */
export const fmtCompact = (n: number) => {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${fmtDec(v, v >= 10 ? 0 : 1)} ${v >= 2 ? 'milhões' : 'milhão'}`;
  }
  if (n >= 1_000) return `${fmtInt(n / 1_000)} mil`;
  return fmtInt(n);
};

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "02/2026" -> "fevereiro de 2026" */
export const fmtPeriodLong = (period?: string) => {
  if (!period) return '';
  const [m, y] = period.split('/').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} de ${y}` : period;
};

/** "02/2026" -> "fev/26" */
export const fmtPeriodShort = (month: number, year: number) =>
  `${(MONTHS[month - 1] ?? '').slice(0, 3)}/${String(year).slice(-2)}`;

export type CategoryKey = CrimeCategory | 'other';

export const CATEGORY_META: Record<CategoryKey, { label: string; short: string; plural: string; color: string; icon: string }> = {
  patrimony: { label: 'Patrimônio', short: 'Patrimônio', plural: 'furtos ou roubos', color: '#64748b', icon: 'building-shield' },
  physical: { label: 'Integridade física', short: 'Integridade', plural: 'agressões ou lesões', color: '#dc2626', icon: 'person-falling-burst' },
  life: { label: 'Contra a vida', short: 'Vida', plural: 'crimes contra a vida', color: '#0f172a', icon: 'skull-crossbones' },
  other: { label: 'Outros', short: 'Outros', plural: 'outros registros', color: '#cbd5e1', icon: 'layer-group' },
};

export type Verdict = 'below' | 'average' | 'above';

export const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string; icon: string }> = {
  below: { label: 'Abaixo da média de SP', color: '#16a34a', bg: '#dcfce7', icon: 'arrow-down' },
  average: { label: 'Próximo da média de SP', color: '#d97706', bg: '#fef3c7', icon: 'equals' },
  above: { label: 'Acima da média de SP', color: '#dc2626', bg: '#fee2e2', icon: 'arrow-up' },
};

/** Classifica a taxa da cidade frente à média estadual (±15% = "na média") */
export const getVerdict = (cityRate?: number, stateRate?: number): { verdict: Verdict; diffPct: number } | null => {
  if (cityRate === undefined || !stateRate) return null;
  const diffPct = ((cityRate - stateRate) / stateRate) * 100;
  const verdict: Verdict = diffPct < -15 ? 'below' : diffPct > 15 ? 'above' : 'average';
  return { verdict, diffPct };
};
