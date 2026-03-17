import { describe, it, expect } from 'vitest';
import * as core from '@mabulu-inc/simplicity-admin-core';

describe('Core public API exports', () => {
  describe('Config functions', () => {
    it('exports defineConfig', () => {
      expect(core.defineConfig).toBeTypeOf('function');
    });

    it('exports loadConfig', () => {
      expect(core.loadConfig).toBeTypeOf('function');
    });

    it('exports resolveConfig', () => {
      expect(core.resolveConfig).toBeTypeOf('function');
    });

    it('exports DEFAULT_CONFIG', () => {
      expect(core.DEFAULT_CONFIG).toBeDefined();
      expect(core.DEFAULT_CONFIG).toBeTypeOf('object');
    });
  });

  describe('Metadata functions', () => {
    it('exports mapPgType', () => {
      expect(core.mapPgType).toBeTypeOf('function');
    });
  });

  describe('Provider classes', () => {
    it('exports ProviderRegistry', () => {
      expect(core.ProviderRegistry).toBeTypeOf('function');
    });

    it('exports createRegistry', () => {
      expect(core.createRegistry).toBeTypeOf('function');
    });
  });

  describe('Plugin classes', () => {
    it('exports PluginManager', () => {
      expect(core.PluginManager).toBeTypeOf('function');
    });
  });

  describe('Error classes', () => {
    it('exports ConfigError', () => {
      expect(core.ConfigError).toBeTypeOf('function');
    });

    it('exports ProviderError', () => {
      expect(core.ProviderError).toBeTypeOf('function');
    });

    it('exports PluginError', () => {
      expect(core.PluginError).toBeTypeOf('function');
    });

    it('exports ValidationError', () => {
      expect(core.ValidationError).toBeTypeOf('function');
    });

    it('exports HookError', () => {
      expect(core.HookError).toBeTypeOf('function');
    });

    it('exports ActionError', () => {
      expect(core.ActionError).toBeTypeOf('function');
    });
  });

  describe('Single import path works', () => {
    it('can destructure all key exports in one import', () => {
      const {
        defineConfig,
        loadConfig,
        resolveConfig,
        mapPgType,
        ProviderRegistry,
        createRegistry,
        PluginManager,
        ConfigError,
        ProviderError,
        PluginError,
        ValidationError,
        HookError,
        ActionError,
        DEFAULT_CONFIG,
      } = core;

      expect(defineConfig).toBeTypeOf('function');
      expect(loadConfig).toBeTypeOf('function');
      expect(resolveConfig).toBeTypeOf('function');
      expect(mapPgType).toBeTypeOf('function');
      expect(ProviderRegistry).toBeTypeOf('function');
      expect(createRegistry).toBeTypeOf('function');
      expect(PluginManager).toBeTypeOf('function');
      expect(ConfigError).toBeTypeOf('function');
      expect(ProviderError).toBeTypeOf('function');
      expect(PluginError).toBeTypeOf('function');
      expect(ValidationError).toBeTypeOf('function');
      expect(HookError).toBeTypeOf('function');
      expect(ActionError).toBeTypeOf('function');
      expect(DEFAULT_CONFIG).toBeTypeOf('object');
    });
  });

  describe('Type exports compile correctly', () => {
    it('ProjectConfig type is usable', () => {
      const config: core.ProjectConfig = {
        database: 'postgres://localhost/test',
      };
      expect(config.database).toBe('postgres://localhost/test');
    });

    it('SchemaMeta type is usable', () => {
      const meta: core.SchemaMeta = {
        tables: [],
        relations: [],
        enums: [],
      };
      expect(meta.tables).toEqual([]);
    });

    it('Provider type is usable', () => {
      const provider: core.Provider = {
        name: 'test',
        version: '1.0.0',
      };
      expect(provider.name).toBe('test');
    });

    it('Plugin type is usable', () => {
      const plugin: core.Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };
      expect(plugin.name).toBe('test-plugin');
    });

    it('ColumnType type is usable', () => {
      const colType: core.ColumnType = 'text';
      expect(colType).toBe('text');
    });
  });
});
