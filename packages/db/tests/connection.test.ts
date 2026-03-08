import { describe, it, expect, afterAll } from 'vitest';
import { createPool, DatabaseError, maskConnectionUrl } from '@simplicity-admin/db';
import type { ConnectionPool } from '@simplicity-admin/core';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

describe('createPool', () => {
  const pools: ConnectionPool[] = [];

  afterAll(async () => {
    for (const pool of pools) {
      try {
        await pool.end();
      } catch {
        // ignore
      }
    }
  });

  it('connects and executes SELECT 1', async () => {
    const pool = createPool(TEST_URL);
    pools.push(pool);

    const result = await pool.query<{ result: number }>('SELECT 1 AS result');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].result).toBe(1);
    expect(result.rowCount).toBe(1);
  });

  it('withClient provides a client that can query', async () => {
    const pool = createPool(TEST_URL);
    pools.push(pool);

    const value = await pool.withClient(async (client) => {
      // PoolClient is opaque but the underlying pg client supports query
      const pgClient = client as unknown as { query: (sql: string) => Promise<{ rows: Array<{ n: number }> }> };
      const res = await pgClient.query('SELECT 42 AS n');
      return res.rows[0].n;
    });

    expect(value).toBe(42);
  });

  it('pool.end() cleans up connections', async () => {
    const pool = createPool(TEST_URL);

    // Verify pool works before ending
    await pool.query('SELECT 1');

    // End the pool
    await pool.end();

    // Further queries should fail
    await expect(pool.query('SELECT 1')).rejects.toThrow();
  });

  it('bad URL throws DatabaseError on query with masked password', async () => {
    const badUrl = 'postgres://user:supersecret@localhost:59999/nonexistent';
    const pool = createPool(badUrl);
    pools.push(pool);

    try {
      await pool.query('SELECT 1');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DatabaseError);
      const dbErr = err as DatabaseError;
      expect(dbErr.code).toBe('DB_002');
      // Password should not appear in error message
      expect(dbErr.message).not.toContain('supersecret');
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
