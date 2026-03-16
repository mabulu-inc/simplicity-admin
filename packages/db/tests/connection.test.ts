import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool, DatabaseError, maskConnectionUrl } from '@simplicity-admin/db';
import type { ConnectionPool } from '@simplicity-admin/core';
import { createTestDb, destroyTestDb, type TestDb } from '../../../test-support/test-db.js';

describe('createPool', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('connects and executes SELECT 1', async () => {
    const result = await testDb.pool.query<{ result: number }>('SELECT 1 AS result');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].result).toBe(1);
    expect(result.rowCount).toBe(1);
  });

  it('withClient provides a client that can query', async () => {
    const value = await testDb.pool.withClient(async (client) => {
      const pgClient = client as unknown as { query: (sql: string) => Promise<{ rows: Array<{ n: number }> }> };
      const res = await pgClient.query('SELECT 42 AS n');
      return res.rows[0].n;
    });

    expect(value).toBe(42);
  });

  it('pool.end() cleans up connections', async () => {
    const extraDb = await createTestDb();

    // Verify pool works before ending
    await extraDb.pool.query('SELECT 1');

    // End the pool
    await extraDb.pool.end();

    // Further queries should fail
    await expect(extraDb.pool.query('SELECT 1')).rejects.toThrow();

    // Clean up the database using a fresh admin connection
    const adminPool = createPool(testDb.url);
    try {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [extraDb.name],
      );
      await adminPool.query(`DROP DATABASE IF EXISTS "${extraDb.name}"`);
    } finally {
      await adminPool.end();
    }
  });

  it('bad URL throws DatabaseError on query with masked password', async () => {
    const badUrl = 'postgres://user:supersecret@localhost:59999/nonexistent';
    const pool = createPool(badUrl);

    try {
      await pool.query('SELECT 1');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DatabaseError);
      const dbErr = err as DatabaseError;
      expect(dbErr.code).toBe('DB_002');
      expect(dbErr.message).not.toContain('supersecret');
    } finally {
      try { await pool.end(); } catch { /* ignore */ }
    }
  });
});

describe('maskConnectionUrl', () => {
  it('masks password in valid URL', () => {
    expect(maskConnectionUrl('postgres://user:secret@host:5432/db'))
      .toBe('postgres://user:***@host:5432/db');
  });

  it('handles URL without password', () => {
    const result = maskConnectionUrl('postgres://user@host:5432/db');
    expect(result).not.toContain('***');
  });

  it('returns placeholder for invalid URL', () => {
    expect(maskConnectionUrl('not-a-url')).toBe('<invalid-url>');
  });
});
