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

    it('sets api.graphiql to false', () => {
      const config = defineConfig({ database: validDb });
      expect(config.api?.graphiql).toBe(false);
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

  describe('Typed schema validation — hooks', () => {
    it('accepts valid hooks with function values', () => {
      const config = defineConfig({
        database: validDb,
        hooks: {
          users: {
            beforeInsert: async () => {},
            afterInsert: async () => {},
          },
        },
      } as Partial<ProjectConfig>);
      expect(config.hooks).toBeDefined();
    });

    it('rejects hooks with a non-object value', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          hooks: { users: 'not-an-object' } as unknown as Record<string, object>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects hooks where a hook field is not a function', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          hooks: {
            users: { beforeInsert: 'not-a-function' },
          } as unknown as Record<string, object>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });
  });

  describe('Typed schema validation — actions', () => {
    it('accepts valid actions with required fields', () => {
      const config = defineConfig({
        database: validDb,
        actions: {
          orders: [
            {
              name: 'approve',
              label: 'Approve Order',
              handler: async () => ({ message: 'done' }),
            },
          ],
        },
      } as Partial<ProjectConfig>);
      expect(config.actions).toBeDefined();
    });

    it('rejects actions missing required name field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          actions: {
            orders: [{ label: 'Approve', handler: async () => ({}) }],
          } as unknown as Record<string, object[]>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects actions missing required label field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          actions: {
            orders: [{ name: 'approve', handler: async () => ({}) }],
          } as unknown as Record<string, object[]>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects actions missing required handler field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          actions: {
            orders: [{ name: 'approve', label: 'Approve' }],
          } as unknown as Record<string, object[]>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects actions where handler is not a function', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          actions: {
            orders: [{ name: 'approve', label: 'Approve', handler: 'bad' }],
          } as unknown as Record<string, object[]>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects actions with invalid variant value', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          actions: {
            orders: [
              {
                name: 'approve',
                label: 'Approve',
                handler: async () => ({}),
                variant: 'invalid',
              },
            ],
          } as unknown as Record<string, object[]>,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('accepts actions with valid optional fields', () => {
      const config = defineConfig({
        database: validDb,
        actions: {
          orders: [
            {
              name: 'approve',
              label: 'Approve Order',
              handler: async () => ({ message: 'done' }),
              icon: 'check',
              variant: 'success',
              bulk: true,
              roles: ['admin'],
              placement: ['row', 'toolbar'],
            },
          ],
        },
      } as Partial<ProjectConfig>);
      expect(config.actions).toBeDefined();
    });
  });

  describe('Typed schema validation — providers', () => {
    it('accepts valid provider overrides', () => {
      const config = defineConfig({
        database: validDb,
        providers: {
          database: { name: 'pg', version: '1.0' },
          token: { name: 'jwt', version: '1.0' },
        },
      } as Partial<ProjectConfig>);
      expect(config.providers).toBeDefined();
    });

    it('rejects providers with a non-object value', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          providers: 'not-an-object' as unknown as object,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects provider missing required name field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          providers: {
            database: { version: '1.0' },
          } as unknown as object,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects provider missing required version field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          providers: {
            database: { name: 'pg' },
          } as unknown as object,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects unknown provider keys', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          providers: {
            unknown: { name: 'x', version: '1.0' },
          } as unknown as object,
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });
  });

  describe('Typed schema validation — plugins', () => {
    it('accepts valid plugins with name and version', () => {
      const config = defineConfig({
        database: validDb,
        plugins: [
          { name: 'audit-log', version: '1.0.0' },
        ],
      } as Partial<ProjectConfig>);
      expect(config.plugins).toHaveLength(1);
    });

    it('rejects plugin missing required name field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          plugins: [{ version: '1.0.0' }] as unknown as object[],
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects plugin missing required version field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          plugins: [{ name: 'audit-log' }] as unknown as object[],
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('rejects plugins as non-array', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          plugins: 'not-an-array' as unknown as object[],
        } as Partial<ProjectConfig>),
      ).toThrow(ConfigError);
    });

    it('accepts plugins with optional lifecycle methods', () => {
      const config = defineConfig({
        database: validDb,
        plugins: [
          {
            name: 'audit-log',
            version: '1.0.0',
            onInit: async () => {},
            onShutdown: async () => {},
          },
        ],
      } as Partial<ProjectConfig>);
      expect(config.plugins).toHaveLength(1);
    });
  });

  describe('Typed schema validation — strategy', () => {
    it('accepts valid custom auth strategy object', () => {
      const config = defineConfig({
        database: validDb,
        auth: {
          strategies: [
            {
              type: 'oauth',
              strategy: {
                name: 'custom-oauth',
                version: '1.0',
                type: 'oauth',
                displayName: 'Custom OAuth',
              },
            },
          ],
        },
      } as Partial<ProjectConfig>);
      expect(config.auth?.strategies).toHaveLength(1);
    });

    it('rejects strategy missing required name field', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          auth: {
            strategies: [
              {
                type: 'oauth',
                strategy: { version: '1.0', type: 'oauth', displayName: 'X' },
              },
            ],
          } as unknown as Partial<ProjectConfig>,
        }),
      ).toThrow(ConfigError);
    });

    it('rejects strategy as a primitive value', () => {
      expect(() =>
        defineConfig({
          database: validDb,
          auth: {
            strategies: [
              { type: 'oauth', strategy: 42 },
            ],
          } as unknown as Partial<ProjectConfig>,
        }),
      ).toThrow(ConfigError);
    });
  });
});
