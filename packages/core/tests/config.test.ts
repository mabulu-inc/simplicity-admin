import { describe, it, expect } from 'vitest';
import { defineConfig, ConfigError } from '@simplicity-admin/core';
import type { ProjectConfig } from '@simplicity-admin/core';

describe('defineConfig', () => {
  const validDb = 'postgres://localhost/mydb';

  describe('B-CORE-001: Config Validation — valid config', () => {
    it('returns a complete ProjectConfig with all defaults applied', () => {
      const config = defineConfig({ database: validDb });
      expect(config).toBeDefined();
      expect(config.database).toBe(validDb);
    });
  });

  describe('B-CORE-002: Config Validation — Missing Database', () => {
    it('throws ConfigError when database is missing', () => {
      expect(() => defineConfig({} as Partial<ProjectConfig>)).toThrow(ConfigError);
    });

    it('error message contains "database is required"', () => {
      expect(() => defineConfig({} as Partial<ProjectConfig>)).toThrow(/database is required/i);
    });

    it('error has code CORE_001', () => {
      try {
        defineConfig({} as Partial<ProjectConfig>);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigError);
        expect((e as ConfigError).code).toBe('CORE_001');
      }
    });
  });

  describe('B-CORE-003: Config Validation — Invalid Types', () => {
    it('rejects port as string', () => {
      expect(() =>
        defineConfig({ database: validDb, port: 'not-a-number' as unknown as number })
      ).toThrow(ConfigError);
    });

    it('rejects basePath as number', () => {
      expect(() =>
        defineConfig({ database: validDb, basePath: 123 as unknown as string })
      ).toThrow(ConfigError);
    });

    it('invalid type error has code CORE_002', () => {
      try {
        defineConfig({ database: validDb, port: 'bad' as unknown as number });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigError);
        expect((e as ConfigError).code).toBe('CORE_002');
      }
    });
  });

  describe('B-CORE-004: Config Defaults Applied', () => {
    it('sets schema to public', () => {
      const config = defineConfig({ database: validDb });
      expect(config.schema).toBe('public');
    });

    it('sets systemSchema to _simplicity_admin', () => {
      const config = defineConfig({ database: validDb });
      expect(config.systemSchema).toBe('_simplicity_admin');
    });

    it('sets port to 3000', () => {
      const config = defineConfig({ database: validDb });
      expect(config.port).toBe(3000);
    });

    it('sets basePath to /admin', () => {
      const config = defineConfig({ database: validDb });
      expect(config.basePath).toBe('/admin');
    });

    it('sets api.graphql to /api/graphql', () => {
      const config = defineConfig({ database: validDb });
      expect(config.api?.graphql).toBe('/api/graphql');
    });

    it('sets api.rest to false', () => {
      const config = defineConfig({ database: validDb });
      expect(config.api?.rest).toBe(false);
    });

    it('sets api.graphiql to true', () => {
      const config = defineConfig({ database: validDb });
      expect(config.api?.graphiql).toBe(true);
    });

    it('sets tenancy.enabled to false', () => {
      const config = defineConfig({ database: validDb });
      expect(config.tenancy?.enabled).toBe(false);
    });

    it('sets tenancy.resolution to header', () => {
      const config = defineConfig({ database: validDb });
      expect(config.tenancy?.resolution).toBe('header');
    });

    it('sets tenancy.header to x-tenant-id', () => {
      const config = defineConfig({ database: validDb });
      expect(config.tenancy?.header).toBe('x-tenant-id');
    });

    it('sets auth.accessTokenTTL to 900', () => {
      const config = defineConfig({ database: validDb });
      expect(config.auth?.accessTokenTTL).toBe(900);
    });

    it('sets auth.refreshTokenTTL to 604800', () => {
      const config = defineConfig({ database: validDb });
      expect(config.auth?.refreshTokenTTL).toBe(604800);
    });

    it('sets auth.strategies to [{ type: password }]', () => {
      const config = defineConfig({ database: validDb });
      expect(config.auth?.strategies).toEqual([{ type: 'password' }]);
    });
  });

  describe('B-CORE-004b: Schema Config — Custom Schema', () => {
    it('preserves custom schema value', () => {
      const config = defineConfig({ database: validDb, schema: 'crm' });
      expect(config.schema).toBe('crm');
    });
  });

  describe('Preserves explicitly set values over defaults', () => {
    it('preserves custom port', () => {
      const config = defineConfig({ database: validDb, port: 8080 });
      expect(config.port).toBe(8080);
    });

    it('preserves custom basePath', () => {
      const config = defineConfig({ database: validDb, basePath: '/my-admin' });
      expect(config.basePath).toBe('/my-admin');
    });

    it('preserves custom api config', () => {
      const config = defineConfig({
        database: validDb,
        api: { graphql: '/gql', rest: '/rest' },
      });
      expect(config.api?.graphql).toBe('/gql');
      expect(config.api?.rest).toBe('/rest');
    });

    it('preserves graphql: false to disable graphql', () => {
      const config = defineConfig({
        database: validDb,
        api: { graphql: false },
      });
      expect(config.api?.graphql).toBe(false);
    });

    it('preserves custom tenancy config', () => {
      const config = defineConfig({
        database: validDb,
        tenancy: { enabled: true, resolution: 'subdomain' },
      });
      expect(config.tenancy?.enabled).toBe(true);
      expect(config.tenancy?.resolution).toBe('subdomain');
    });

    it('preserves custom auth config', () => {
      const config = defineConfig({
        database: validDb,
        auth: { accessTokenTTL: 1800, refreshTokenTTL: 86400 },
      });
      expect(config.auth?.accessTokenTTL).toBe(1800);
      expect(config.auth?.refreshTokenTTL).toBe(86400);
    });
  });
});
