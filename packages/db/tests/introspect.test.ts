import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool } from '@simplicity-admin/db';
import { listTables } from '../src/introspect/tables.js';
import type { ConnectionPool } from '@simplicity-admin/core';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';
const TEST_SCHEMA = 'test_introspect_tables';

describe('listTables', () => {
  let pool: ConnectionPool;

  beforeAll(async () => {
    pool = createPool(TEST_URL);

    // Create a test schema with some tables
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL)`);
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.deals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text)`);
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.activities (id serial PRIMARY KEY, description text)`);

    // Add a comment to one table
    await pool.query(`COMMENT ON TABLE ${TEST_SCHEMA}.contacts IS 'Contact records'`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.end();
  });

  it('returns table names from test schema', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(['activities', 'contacts', 'deals']);
  });

  it('excludes pg_* and information_schema tables', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.name).not.toMatch(/^pg_/);
      expect(t.schema).not.toBe('information_schema');
    }
  });

  it('respects schema filter', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.schema).toBe(TEST_SCHEMA);
    }

    // Verify other schemas are not included
    const publicTables = await listTables(pool, 'public');
    const publicNames = publicTables.map((t) => t.name);
    expect(publicNames).not.toContain('contacts');
  });

  it('includes table comments', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    const contacts = tables.find((t) => t.name === 'contacts');
    expect(contacts).toBeDefined();
    expect(contacts!.comment).toBe('Contact records');
  });

  it('returns null comment for tables without comments', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    const deals = tables.find((t) => t.name === 'deals');
    expect(deals).toBeDefined();
    expect(deals!.comment).toBeNull();
  });

  it('defaults to public schema when no schema specified', async () => {
    const tables = await listTables(pool);
    for (const t of tables) {
      expect(t.schema).toBe('public');
    }
  });

  it('returns empty columns and primaryKey arrays (columns populated by introspectColumns)', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.columns).toEqual([]);
      expect(t.primaryKey).toEqual([]);
    }
  });

  it('sets schema property on each TableMeta', async () => {
    const tables = await listTables(pool, TEST_SCHEMA);
    for (const t of tables) {
      expect(t.schema).toBe(TEST_SCHEMA);
    }
  });
});
