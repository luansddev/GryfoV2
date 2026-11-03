/**
 * src/services/api/__tests__/apiConfig.test.ts
 * Testes para a configuração centralizada da API e regras de protocolo por ambiente.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import {
  validateApiBaseUrl,
  getCrimeDataSource,
  getApiBaseUrl,
  apiConfig,
} from '../../../config/api';

describe('src/config/api.ts', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  describe('getCrimeDataSource', () => {
    it('deve adotar "firebase" como padrão quando a variável de ambiente não estiver definida', () => {
      delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE;
      expect(getCrimeDataSource()).toBe('firebase');
      expect(apiConfig.source).toBe('firebase');
    });

    it('deve aceitar explicitamente "api" (case-insensitive e com espaços)', () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = '  API  ';
      expect(getCrimeDataSource()).toBe('api');
      expect(apiConfig.source).toBe('api');
    });

    it('deve aceitar explicitamente "firebase"', () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'firebase';
      expect(getCrimeDataSource()).toBe('firebase');
      expect(apiConfig.source).toBe('firebase');
    });

    it('deve adotar "firebase" caso um valor desconhecido seja informado', () => {
      process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE = 'outro_valor';
      expect(getCrimeDataSource()).toBe('firebase');
      expect(apiConfig.source).toBe('firebase');
    });
  });

  describe('validateApiBaseUrl', () => {
    it('Cenário 13: não lança erro durante a importação quando a fonte é firebase e não há URL configurada', () => {
      delete process.env.EXPO_PUBLIC_GARDIO_API_URL;
      delete process.env.EXPO_PUBLIC_CRIME_DATA_SOURCE;

      // Importar e acessar apiConfig.source não deve lançar exceção
      expect(apiConfig.source).toBe('firebase');
    });

    it('Cenário 14: lança erro claro quando a URL está ausente ou vazia', () => {
      expect(() => validateApiBaseUrl(undefined, true)).toThrow(
        /EXPO_PUBLIC_GARDIO_API_URL/
      );
      expect(() => validateApiBaseUrl('', true)).toThrow(
        /EXPO_PUBLIC_GARDIO_API_URL/
      );
      expect(() => validateApiBaseUrl('   ', true)).toThrow(
        /EXPO_PUBLIC_GARDIO_API_URL/
      );
    });

    it('remove barras finais redundantes da URL', () => {
      const sanitized = validateApiBaseUrl('http://localhost:8000///', true);
      expect(sanitized).toBe('http://localhost:8000');
    });

    it('lança erro se a URL informada não for sintaticamente válida', () => {
      expect(() => validateApiBaseUrl('nao_e_uma_url', true)).toThrow(
        /URL da Gardio Intelligence API inválida/
      );
    });

    it('lança erro para protocolos não suportados (ex: ftp:)', () => {
      expect(() => validateApiBaseUrl('ftp://localhost:8000', true)).toThrow(
        /Protocolo não suportado/
      );
    });

    it('permite HTTP em ambiente de desenvolvimento (isDev = true)', () => {
      expect(validateApiBaseUrl('http://localhost:8000', true)).toBe('http://localhost:8000');
      expect(validateApiBaseUrl('http://10.0.2.2:8000', true)).toBe('http://10.0.2.2:8000');
      expect(validateApiBaseUrl('http://192.168.1.15:8000', true)).toBe('http://192.168.1.15:8000');
    });

    it('Cenário 15: bloqueia HTTP em ambiente de produção (isDev = false)', () => {
      expect(() => validateApiBaseUrl('http://api.gardio.br', false)).toThrow(
        /insegura para ambiente de produção/
      );
    });

    it('aceita HTTPS tanto em desenvolvimento quanto em produção', () => {
      expect(validateApiBaseUrl('https://api.gardio.br', true)).toBe('https://api.gardio.br');
      expect(validateApiBaseUrl('https://api.gardio.br', false)).toBe('https://api.gardio.br');
    });
  });

  describe('getApiBaseUrl e apiConfig.getBaseUrl', () => {
    it('lê e valida corretamente a URL a partir de EXPO_PUBLIC_GARDIO_API_URL', () => {
      process.env.EXPO_PUBLIC_GARDIO_API_URL = 'http://10.0.2.2:8000';
      expect(getApiBaseUrl()).toBe('http://10.0.2.2:8000');
      expect(apiConfig.getBaseUrl()).toBe('http://10.0.2.2:8000');
    });

    it('lança erro ao chamar getBaseUrl quando EXPO_PUBLIC_GARDIO_API_URL não estiver definida', () => {
      delete process.env.EXPO_PUBLIC_GARDIO_API_URL;
      expect(() => apiConfig.getBaseUrl()).toThrow(/EXPO_PUBLIC_GARDIO_API_URL/);
    });
  });
});
