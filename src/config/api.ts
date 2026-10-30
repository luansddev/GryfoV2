/**
 * src/config/api.ts
 * Configuração centralizada da Gardio Intelligence API.
 */

export type CrimeDataSource = 'firebase' | 'api';

export interface ApiConfig {
  readonly source: CrimeDataSource;
  readonly getBaseUrl: () => string;
}

/**
 * Determina se o ambiente de execução atual é de desenvolvimento.
 */
export function isDevelopmentEnvironment(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return Boolean(__DEV__);
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * Valida a URL base da Gardio Intelligence API segundo as regras de ambiente:
 * - Em produção, exige HTTPS estrito.
 * - Em desenvolvimento, aceita HTTP e HTTPS (ex.: localhost, 10.0.2.2, IPs locais).
 * - Remove barras finais redundantes.
 * - Lança erro claro se a URL estiver ausente ou inválida.
 */
export function validateApiBaseUrl(
  rawUrl?: string | null,
  isDev: boolean = isDevelopmentEnvironment()
): string {
  if (!rawUrl || rawUrl.trim() === '') {
    throw new Error(
      'A URL da Gardio Intelligence API não foi informada. ' +
      'Defina a variável de ambiente EXPO_PUBLIC_GARDIO_API_URL para utilizar a fonte "api".'
    );
  }

  const trimmed = rawUrl.trim().replace(/\/+$/, '');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `URL da Gardio Intelligence API inválida: "${trimmed}". ` +
      'Certifique-se de informar uma URL absoluta válida com protocolo (ex: "http://localhost:8000" ou "https://api.gardio.br").'
    );
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(
      `Protocolo não suportado na URL da API: "${parsed.protocol}". ` +
      'Utilize "http:" em desenvolvimento ou "https:" em produção.'
    );
  }

  if (!isDev && protocol !== 'https:') {
    throw new Error(
      `URL da Gardio Intelligence API insegura para ambiente de produção: "${trimmed}". ` +
      'Em builds de produção, conexões com a API devem obrigatoriamente utilizar HTTPS.'
    );
  }

  return trimmed;
}

/**
 * Retorna a fonte de dados criminais ativa com base em EXPO_PUBLIC_CRIME_DATA_SOURCE.
 * Padrão seguro: 'firebase'.
 */
/**
 * Obtém o valor de uma variável de ambiente de forma compatível com transformações
 * estáticas e dinâmicas de bundlers (Metro/Babel/Jest).
 */
function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process && process.env) {
    return (process as unknown as { env: Record<string, string | undefined> }).env[key];
  }
  return undefined;
}

/**
 * Retorna a fonte de dados criminais ativa com base em EXPO_PUBLIC_CRIME_DATA_SOURCE.
 * Padrão seguro: 'firebase'.
 */
export function getCrimeDataSource(): CrimeDataSource {
  const envVal = readEnv('EXPO_PUBLIC_CRIME_DATA_SOURCE')?.trim().toLowerCase();
  if (envVal === 'api') {
    return 'api';
  }
  return 'firebase';
}

/**
 * Retorna a URL base validada da API lendo de process.env.EXPO_PUBLIC_GARDIO_API_URL.
 * Lança erro caso a URL esteja ausente ou viole as regras de protocolo.
 */
export function getApiBaseUrl(): string {
  return validateApiBaseUrl(
    readEnv('EXPO_PUBLIC_GARDIO_API_URL'),
    isDevelopmentEnvironment()
  );
}

/**
 * Objeto de configuração exportado.
 * Avaliação preguiçosa (lazy) para que a importação do módulo não dispare erro
 * quando a fonte for 'firebase' e a URL da API não estiver definida.
 */
export const apiConfig: ApiConfig = {
  get source(): CrimeDataSource {
    return getCrimeDataSource();
  },
  getBaseUrl(): string {
    return getApiBaseUrl();
  },
};
