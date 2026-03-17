import { describe, it, expect, vi } from 'vitest';
import { PluginManager, PluginError } from '@mabulu-inc/simplicity-admin-core';
import type { Plugin, SchemaMeta, ProjectConfig, AppContext } from '@mabulu-inc/simplicity-admin-core';

const dummyConfig = { database: 'postgres://localhost/test' } as ProjectConfig;

const emptySchemaMeta: SchemaMeta = {
  tables: [],
  relations: [],
  enums: [],
};

function makePlugin(name: string, hooks?: Partial<Plugin>): Plugin {
  return { name, version: '1.0.0', ...hooks };
}

describe('PluginManager', () => {
  describe('hook execution order (B-CORE-010)', () => {
    it('executes onInit hooks in registration order', async () => {
      const order: string[] = [];
      const plugins: Plugin[] = [
        makePlugin('A', { onInit: async () => { order.push('A'); } }),
        makePlugin('B', { onInit: async () => { order.push('B'); } }),
        makePlugin('C', { onInit: async () => { order.push('C'); } }),
      ];

      const manager = new PluginManager(plugins);
      await manager.runHook('onInit', dummyConfig);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('executes onReady hooks in registration order', async () => {
      const order: string[] = [];
      const ctx = { config: dummyConfig } as AppContext;
      const plugins: Plugin[] = [
        makePlugin('X', { onReady: async () => { order.push('X'); } }),
        makePlugin('Y', { onReady: async () => { order.push('Y'); } }),
      ];

      const manager = new PluginManager(plugins);
      await manager.runHook('onReady', ctx);

      expect(order).toEqual(['X', 'Y']);
    });
  });

  describe('onSchemaLoaded chaining (B-CORE-011)', () => {
    it('chains transformations — A transforms, B receives A output', async () => {
      const virtualTable = {
        name: 'virtual',
        schema: 'public',
        columns: [],
        primaryKey: [],
        comment: null,
      };

      const pluginA = makePlugin('A', {
        onSchemaLoaded: async (meta: SchemaMeta) => ({
          ...meta,
          tables: [...meta.tables, virtualTable],
        }),
      });

      const pluginB = makePlugin('B', {
        onSchemaLoaded: async (meta: SchemaMeta) => meta, // identity
      });

      const manager = new PluginManager([pluginA, pluginB]);
      const result = await manager.runHook('onSchemaLoaded', emptySchemaMeta);

      expect(result).toEqual({
        tables: [virtualTable],
        relations: [],
        enums: [],
      });
    });

    it('chains multiple transformations', async () => {
      const pluginA = makePlugin('A', {
        onSchemaLoaded: async (meta: SchemaMeta) => ({
          ...meta,
          tables: [...meta.tables, { name: 'a_table', schema: 'public', columns: [], primaryKey: [], comment: null }],
        }),
      });

      const pluginB = makePlugin('B', {
        onSchemaLoaded: async (meta: SchemaMeta) => ({
          ...meta,
          tables: [...meta.tables, { name: 'b_table', schema: 'public', columns: [], primaryKey: [], comment: null }],
        }),
      });

      const manager = new PluginManager([pluginA, pluginB]);
      const result = await manager.runHook('onSchemaLoaded', emptySchemaMeta);

      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].name).toBe('a_table');
      expect(result.tables[1].name).toBe('b_table');
    });
  });

  describe('skips plugins without the hook', () => {
    it('skips plugins that do not implement onInit', async () => {
      const order: string[] = [];
      const plugins: Plugin[] = [
        makePlugin('A', { onInit: async () => { order.push('A'); } }),
        makePlugin('B'), // no onInit
        makePlugin('C', { onInit: async () => { order.push('C'); } }),
      ];

      const manager = new PluginManager(plugins);
      await manager.runHook('onInit', dummyConfig);

      expect(order).toEqual(['A', 'C']);
    });

    it('skips plugins that do not implement onSchemaLoaded', async () => {
      const pluginA = makePlugin('A', {
        onSchemaLoaded: async (meta: SchemaMeta) => ({
          ...meta,
          tables: [...meta.tables, { name: 'added', schema: 'public', columns: [], primaryKey: [], comment: null }],
        }),
      });
      const pluginB = makePlugin('B'); // no onSchemaLoaded

      const manager = new PluginManager([pluginA, pluginB]);
      const result = await manager.runHook('onSchemaLoaded', emptySchemaMeta);

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].name).toBe('added');
    });
  });

  describe('error handling', () => {
    it('throws PluginError wrapping original error', async () => {
      const originalError = new Error('init failed');
      const plugins: Plugin[] = [
        makePlugin('bad-plugin', {
          onInit: async () => { throw originalError; },
        }),
      ];

      const manager = new PluginManager(plugins);

      await expect(manager.runHook('onInit', dummyConfig)).rejects.toThrow(PluginError);
    });

    it('PluginError includes plugin name and hook name', async () => {
      const plugins: Plugin[] = [
        makePlugin('my-plugin', {
          onInit: async () => { throw new Error('boom'); },
        }),
      ];

      const manager = new PluginManager(plugins);

      try {
        await manager.runHook('onInit', dummyConfig);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginError);
        const pluginErr = err as InstanceType<typeof PluginError>;
        expect(pluginErr.message).toContain('my-plugin');
        expect(pluginErr.message).toContain('onInit');
        expect(pluginErr.code).toBe('CORE_006');
        expect(pluginErr.cause).toBeInstanceOf(Error);
      }
    });

    it('PluginError wraps error from onSchemaLoaded', async () => {
      const plugins: Plugin[] = [
        makePlugin('schema-plugin', {
          onSchemaLoaded: async () => { throw new Error('schema fail'); },
        }),
      ];

      const manager = new PluginManager(plugins);

      await expect(manager.runHook('onSchemaLoaded', emptySchemaMeta)).rejects.toThrow(PluginError);
    });
  });

  describe('constructor', () => {
    it('accepts empty plugin array', async () => {
      const manager = new PluginManager([]);
      // Should not throw for any hook
      await manager.runHook('onInit', dummyConfig);
      const result = await manager.runHook('onSchemaLoaded', emptySchemaMeta);
      expect(result).toEqual(emptySchemaMeta);
    });
  });
});
