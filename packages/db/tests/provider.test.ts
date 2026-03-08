import { describe, it, expect, afterAll } from 'vitest';
import { postgresProvider } from '@simplicity-admin/db';
import type { DatabaseProvider, ConnectionPool, SchemaMeta } from '@simplicity-admin/core';

const TEST_URL = process.env['DATABASE_URL'] ?? 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

describe('postgresProvider', () => {
  let provider: DatabaseProvider;
  let pool: ConnectionPool;

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('returns a DatabaseProvider', () => {
    provider = postgresProvider();
    expect(provider.name).toBe('postgres');
    expect(provider.version).toBeTruthy();
  });

  it('implements all DatabaseProvider methods', () => {
    provider = postgresProvider();
    expect(typeof provider.connect).toBe('function');
    expect(typeof provider.introspect).toBe('function');
    expect(typeof provider.migrate).toBe('function');
    expect(typeof provider.generate).toBe('function');
  });

  it('connect() returns a working ConnectionPool', async () => {
    provider = postgresProvider();
    pool = await provider.connect(TEST_URL);

    const result = await pool.query<{ val: number }>('SELECT 1 AS val');
    expect(result.rows[0]?.val).toBe(1);
  });

  it('introspect() returns SchemaMeta', async () => {
    provider = postgresProvider();
    pool = await provider.connect(TEST_URL);

    // Create a temp table to introspect
    await pool.query(`
      CREATE TABLE IF NOT EXISTS provider_test_introspect (
        id serial PRIMARY KEY,
        name text NOT NULL
      )
    `);

    const meta: SchemaMeta = await provider.introspect(pool, 'public');
    expect(meta.tables).toBeDefined();
    expect(Array.isArray(meta.tables)).toBe(true);

    const testTable = meta.tables.find(t => t.name === 'provider_test_introspect');
    expect(testTable).toBeDefined();
    expect(testTable!.columns.length).toBeGreaterThan(0);

    // Cleanup
    await pool.query('DROP TABLE IF EXISTS provider_test_introspect');
  });

  it('migrate() runs bootstrap (schema-flow)', async () => {
    provider = postgresProvider();
    pool = await provider.connect(TEST_URL);

    // Create a unique schema to test migration in isolation
    const testSchema = 'provider_migrate_test';
    await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    await pool.query(`CREATE SCHEMA ${testSchema}`);

    const result = await provider.migrate(pool, {
      schemaDir: '',
      schema: testSchema,
    });

    expect(result.applied).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.operations)).toBe(true);

    // Cleanup
    await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
  });

  it('generate() does not throw', async () => {
    provider = postgresProvider();
    pool = await provider.connect(TEST_URL);

    // generate() is a placeholder until schema-flow generate is implemented
    await expect(provider.generate(pool, '/tmp/test-generate', 'public')).resolves.not.toThrow();
  });
});
