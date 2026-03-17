import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { listTables } from '../src/introspect/tables.js';
import { createTestDb, destroyTestDb, type TestDb } from '@mabulu-inc/simplicity-admin-test-support';

const TEST_SCHEMA = 'test_introspect_tables';

describe('listTables', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();

    await testDb.pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL)`);
    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.deals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text)`);
    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.activities (id serial PRIMARY KEY, description text)`);
    await testDb.pool.query(`COMMENT ON TABLE ${TEST_SCHEMA}.contacts IS 'Contact records'`);
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('returns table names from test schema', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(['activities', 'contacts', 'deals']);
  });

  it('excludes pg_* and information_schema tables', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.name).not.toMatch(/^pg_/);
      expect(t.schema).not.toBe('information_schema');
    }
  });

  it('respects schema filter', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.schema).toBe(TEST_SCHEMA);
    }

    const publicTables = await listTables(testDb.pool, 'public');
    const publicNames = publicTables.map((t) => t.name);
    expect(publicNames).not.toContain('contacts');
  });

  it('includes table comments', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    const contacts = tables.find((t) => t.name === 'contacts');
    expect(contacts).toBeDefined();
    expect(contacts!.comment).toBe('Contact records');
  });

  it('returns null comment for tables without comments', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    const deals = tables.find((t) => t.name === 'deals');
    expect(deals).toBeDefined();
    expect(deals!.comment).toBeNull();
  });

  it('defaults to public schema when no schema specified', async () => {
    const tables = await listTables(testDb.pool);
    for (const t of tables) {
      expect(t.schema).toBe('public');
    }
  });

  it('returns empty columns and primaryKey arrays (columns populated by introspectColumns)', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.columns).toEqual([]);
      expect(t.primaryKey).toEqual([]);
    }
  });

  it('sets schema property on each TableMeta', async () => {
    const tables = await listTables(testDb.pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.schema).toBe(TEST_SCHEMA);
    }
  });
});
