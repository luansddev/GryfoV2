/**
 * CityDirectory
 * Une as chaves de cidade usadas pela SSP-SP (ex: "S.PAULO", "S.ANDRE",
 * "ESPIRITO STO. PINHAL") aos nomes oficiais do IBGE (ex: "São Paulo",
 * "Santo André"), permitindo:
 *  - exibir nomes legíveis (com acentos) para o grande público;
 *  - encontrar a cidade digitada pelo usuário de forma tolerante;
 *  - obter a população (Censo 2022) para calcular taxas por 100 mil hab.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const IBGE_POPULATION_URL =
  'https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[N3[35]]';
const STORAGE_KEY = '@gryfo/ibge_sp_population_2022';

/** Chaves do JSON da SSP que não representam municípios */
export const NON_CITY_KEYS = ['nome_da_cidade', 'timestamp', 'OUTRO PAIS'];

/**
 * Normaliza qualquer nome de cidade para uma chave comparável.
 * "Santo André" -> "S.ANDRE" | "São Paulo - SP" -> "S.PAULO" | "Estrela d'Oeste" -> "ESTRELA D OESTE"
 */
export const cityMatchKey = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s*-\s*SP$/, '')
    .replace(/['`´]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\bSTO\.\s*/g, 'S.')
    .replace(/\b(SAO|SANTA|SANTO)\s+/g, 'S.')
    .replace(/\bS\.\s+/g, 'S.')
    .replace(/\s+/g, ' ')
    .trim();

/** Abreviações da SSP que não seguem um padrão previsível (chave SSP -> chave IBGE) */
const SSP_ALIASES: Record<string, string> = {
  'S.ANTONIO DE ARACANGUA': 'S.ANTONIO DO ARACANGUA',
  'S.RITA PASSA QUATRO': 'S.RITA DO PASSA QUATRO',
  'S.JOAO DUAS PONTES': 'S.JOAO DAS DUAS PONTES',
  'MIRANTE PARANAPANEMA': 'MIRANTE DO PARANAPANEMA',
  'CAMPINA MONTE ALEGRE': 'CAMPINA DO MONTE ALEGRE',
  'FLORINIA': 'FLORINEA',
  'EUCLIDES DA CUNHA PTA': 'EUCLIDES DA CUNHA PAULISTA',
  'RIBEIRAO INDIOS': 'RIBEIRAO DOS INDIOS',
  'ESPIRITO S.PINHAL': 'ESPIRITO S.DO PINHAL',
  'PIRAPORA BOM JESUS': 'PIRAPORA DO BOM JESUS',
};

const toIbgeKey = (sspKey: string) => {
  const k = cityMatchKey(sspKey);
  return SSP_ALIASES[k] ?? k;
};

export interface IbgeCity {
  name: string; // Nome oficial, ex: "São José dos Campos"
  population: number;
}

let memoryCache: Record<string, IbgeCity> | null = null;
let pending: Promise<Record<string, IbgeCity> | null> | null = null;

/** Mapa chave-normalizada -> { nome oficial, população }. Retorna null se indisponível. */
export const loadIbgeCities = async (): Promise<Record<string, IbgeCity> | null> => {
  if (memoryCache) return memoryCache;
  if (pending) return pending;

  pending = (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryCache = JSON.parse(stored);
        return memoryCache;
      }
    } catch {
      // ignora cache corrompido
    }

    try {
      const res = await fetch(IBGE_POPULATION_URL);
      if (!res.ok) throw new Error(`IBGE ${res.status}`);
      const json = await res.json();
      const series: any[] = json?.[0]?.resultados?.[0]?.series ?? [];
      const map: Record<string, IbgeCity> = {};
      for (const s of series) {
        const rawName: string = s?.localidade?.nome ?? '';
        const population = Number(s?.serie?.['2022']);
        if (!rawName || !population) continue;
        const name = rawName.replace(/\s*-\s*SP$/, '');
        map[cityMatchKey(name)] = { name, population };
      }
      if (Object.keys(map).length > 0) {
        memoryCache = map;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => {});
      }
      return memoryCache;
    } catch (err) {
      console.warn('Não foi possível obter a população do IBGE:', err);
      return null;
    }
  })();

  const result = await pending;
  pending = null;
  return result;
};

/** Busca a cidade do IBGE correspondente a uma chave da SSP */
export const getIbgeCityForSspKey = (
  sspKey: string,
  ibge: Record<string, IbgeCity> | null
): IbgeCity | undefined => (ibge ? ibge[toIbgeKey(sspKey)] : undefined);

/** Fallback legível a partir da chave da SSP: "S.JOSE DOS CAMPOS" -> "S. Jose dos Campos" */
export const prettifySspKey = (sspKey: string): string => {
  const lowerWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'd'];
  return sspKey
    .replace(/\bS\./g, 'São ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && lowerWords.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
};

/** Nome amigável para exibição */
export const getCityDisplayName = (sspKey: string, ibge: Record<string, IbgeCity> | null): string =>
  getIbgeCityForSspKey(sspKey, ibge)?.name ?? prettifySspKey(sspKey);

/**
 * Resolve um nome qualquer (vindo do GPS, do contexto ou digitado) para a chave
 * exata usada no JSON da SSP. Ex: "S. PAULO" -> "S.PAULO", "Santo André" -> "S.ANDRE".
 */
export const resolveSspKey = (input: string | null, sspKeys: string[]): string | null => {
  if (!input) return null;
  if (sspKeys.includes(input)) return input;
  const target = cityMatchKey(input);
  for (const key of sspKeys) {
    const k = cityMatchKey(key);
    if (k === target || (SSP_ALIASES[k] ?? k) === target) return key;
  }
  return null;
};
