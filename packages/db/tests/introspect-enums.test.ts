import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool } from '@simplicity-admin/db';
import { introspectEnums } from '../src/introspect/enums.js';
import type { ConnectionPool } from '@simplicity-admin/core';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';
const TEST_SCHEMA = 'test_introspect_enums';

describe('introspectEnums', () => {
  let pool: ConnectionPool;

  beforeAll(async () => {
    pool = createPool(TEST_URL);

    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);

    // Create enum types
    await pool.query(`CREATE TYPE ${TEST_SCHEMA}.article_status AS ENUM ('draft', 'review', 'published')`);
    await pool.query(`CREATE TYPE ${TEST_SCHEMA}.priority_level AS ENUM ('low', 'medium', 'high', 'critical')`);

    // Create a table using one of the enums (to ensure enums are discovered independently of usage)
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.articles (
      id serial PRIMARY KEY,
      status ${TEST_SCHEMA}.article_status DEFAULT 'draft'
    )`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.end();
  });

  it('discovers enum types in the schema', async () => {
    const enums = await introspectEnums(pool, TEST_SCHEMA);
    expect(enums.length).toBeGreaterThanOrEqual(2);

    const names = enums.map((e) => e.name);
    expect(names).toContain('article_status');
    expect(names).toContain('priority_level');
  });

  it('returns values in defined order', async () => {
    const enums = await introspectEnums(pool, TEST_SCHEMA);
    const articleStatus = enums.find((e) => e.name === 'article_status');
    expect(articleStatus).toBeDefined();
    expect(articleStatus!.values).toEqual(['draft', 'review', 'published']);

    const priority = enums.find((e) => e.name === 'priority_level');
    expect(priority).toBeDefined();
    expect(priority!.values).toEqual(['low', 'medium', 'high', 'critical']);
  });

  it('includes schema qualification', async () => {
    const enums = await introspectEnums(pool, TEST_SCHEMA);
    for (const e of enums) {
      expect(e.schema).toBe(TEST_SCHEMA);
    }
  });

  it('defaults to public schema', async () => {
    const enums = await introspectEnums(pool);
    // Should not include our test schema enums
    for (const e of enums) {
      expect(e.schema).not.toBe(TEST_SCHEMA);
    }
  });

  it('returns empty array for schema with no enums', async () => {
    const emptySchema = `${TEST_SCHEMA}_empty`;
    await pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
    await pool.query(`CREATE SCHEMA ${emptySchema}`);

    const enums = await introspectEnums(pool, emptySchema);
    expect(enums).toEqual([]);

    await pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
  });

  it('wraps errors in DatabaseError', async () => {
    const badPool = createPool('postgres://simplicity:simplicity@localhost:5432/simplicity_admin');
    // Force an error by ending the pool first
    await badPool.end();

    await expect(introspectEnums(badPool, TEST_SCHEMA)).rejects.toThrow();
  });
});
