import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { postgresProvider } from '@simplicity-admin/db';
import type { DatabaseProvider, ConnectionPool, SchemaMeta } from '@simplicity-admin/core';
import { createTestDb, destroyTestDb, type TestDb } from '@simplicity-admin/test-support';

describe('postgresProvider', () => {
  let testDb: TestDb;
  let provider: DatabaseProvider;

  beforeAll(async () => {
    testDb = await createTestDb();
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
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
    const pool = await provider.connect(testDb.url);

    const result = await pool.query<{ val: number }>('SELECT 1 AS val');
    expect(result.rows[0]?.val).toBe(1);
    await pool.end();
  });

  it('introspect() returns SchemaMeta', async () => {
    provider = postgresProvider();
    const pool = await provider.connect(testDb.url);

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

    await pool.end();
  });

  it('migrate() runs bootstrap (simplicity-schema)', async () => {
    provider = postgresProvider();
    const pool = await provider.connect(testDb.url);

    const testSchema = 'provider_migrate_test';
    await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    await pool.query(`CREATE SCHEMA ${testSchema}`);

    const result = await provider.migrate(pool, {
      schemaDir: '',
      schema: testSchema,
    });

    expect(result.applied).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.operations)).toBe(true);

    await pool.end();
  });

  it('generate() does not throw', async () => {
    provider = postgresProvider();
    const pool = await provider.connect(testDb.url);

    await expect(provider.generate(pool, '/tmp/test-generate', 'public')).resolves.not.toThrow();
    await pool.end();
  });
});
