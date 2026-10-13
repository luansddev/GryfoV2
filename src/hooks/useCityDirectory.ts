import { useEffect, useState } from 'react';
import { fetchAvailableHistory } from '../services/analytics/CrimeHistoryService';
import {
  loadIbgeCities,
  getIbgeCityForSspKey,
  getCityDisplayName,
  cityMatchKey,
  NON_CITY_KEYS,
} from '../services/analytics/CityDirectory';

export interface CityOption {
  /** Chave exata usada no JSON da SSP (ex: "S.JOSE DOS CAMPOS") */
  key: string;
  /** Nome legível (ex: "São José dos Campos") */
  displayName: string;
  /** Chaves normalizadas usadas na busca */
  searchKeys: string[];
}

/** Remove acentos/caixa para comparar texto digitado com nomes */
export const plainText = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Lista de cidades paulistas com dados da SSP, já com nomes oficiais do IBGE.
 * Cidades fora de SP que aparecem no JSON (sem correspondência no IBGE) são omitidas
 * quando a lista do IBGE está disponível.
 */
export const useCityDirectory = () => {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [history, ibge] = await Promise.all([fetchAvailableHistory(), loadIbgeCities()]);
        const ssp = history.length > 0 ? history[history.length - 1].data : null;
        if (!ssp || cancelled) return;
        const options: CityOption[] = Object.keys(ssp)
          .filter(k => !NON_CITY_KEYS.includes(k))
          .filter(k => !ibge || !!getIbgeCityForSspKey(k, ibge))
          .map(key => {
            const displayName = getCityDisplayName(key, ibge);
            return {
              key,
              displayName,
              searchKeys: [plainText(displayName), cityMatchKey(displayName), cityMatchKey(key)],
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
        if (!cancelled) setCities(options);
      } catch (err) {
        console.error('Erro ao carregar lista de cidades:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Filtra por texto digitado; cidades que COMEÇAM com o termo aparecem primeiro */
  const search = (text: string, limit = 6): CityOption[] => {
    const q = plainText(text);
    if (!q) return [];
    const qKey = cityMatchKey(text);
    const starts: CityOption[] = [];
    const contains: CityOption[] = [];
    for (const c of cities) {
      if (c.searchKeys.some(k => k.startsWith(q) || k.startsWith(qKey))) starts.push(c);
      else if (c.searchKeys.some(k => k.includes(q) || k.includes(qKey))) contains.push(c);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  };

  return { cities, ready, search };
};
