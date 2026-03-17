import type {
  DatabaseProvider,
  ConnectionPool,
  MigrationConfig,
  MigrationResult,
  SchemaMeta,
} from '@mabulu-inc/simplicity-admin-core';
import { createPool } from './connection.js';
import { introspectSchema } from './introspect/index.js';
import { bootstrap } from './bootstrap.js';

/**
 * Creates the default PostgreSQL DatabaseProvider.
 * Wraps existing connection, introspection, and bootstrap modules.
 */
export function postgresProvider(): DatabaseProvider {
  let connectionUrl = '';

  return {
    name: 'postgres',
    version: '0.0.1',

    async connect(url: string): Promise<ConnectionPool> {
      connectionUrl = url;
      const pool = createPool(url);
      // Verify connectivity by running a trivial query
      await pool.query('SELECT 1');
      return pool;
    },

    async introspect(pool: ConnectionPool, schema?: string): Promise<SchemaMeta> {
      return introspectSchema(pool, schema);
    },

    async migrate(pool: ConnectionPool, config: MigrationConfig): Promise<MigrationResult> {
      await bootstrap(pool, {
        database: connectionUrl,
        schema: config.schema ?? 'public',
      });
      return {
        applied: 1,
        operations: ['bootstrap'],
      };
    },

    async generate(
      _pool: ConnectionPool,
      _outputDir: string,
      _schema?: string,
    ): Promise<void> {
      // Placeholder — full simplicity-schema YAML generation will be implemented
      // when the generate-from-db feature is built (B-DB-017).
    },
  };
}
