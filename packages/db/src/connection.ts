import pg from 'pg';
import type { ConnectionPool, QueryResult, PoolClient } from '@mabulu-inc/simplicity-admin-core';
import { DatabaseError, maskConnectionUrl } from './errors.js';

const { Pool } = pg;

/**
 * Creates a ConnectionPool backed by pg.Pool.
 * The pool connects lazily — the first query triggers the connection.
 */
export function createPool(url: string): ConnectionPool {
  let pool: pg.Pool;

  try {
    pool = new Pool({ connectionString: url });
  } catch (err) {
    throw new DatabaseError(
      `Failed to create connection pool for ${maskConnectionUrl(url)}: ${err instanceof Error ? err.message : String(err)}`,
      'DB_001',
      err instanceof Error ? err : undefined,
    );
  }

  // Attach error handler to prevent unhandled rejections on idle clients
  pool.on('error', () => {
    // Idle client errors are expected when the server restarts.
    // They'll surface as query errors on next use.
  });

  const connectionPool: ConnectionPool = {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      try {
        const result = await pool.query(sql, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? 0,
        };
      } catch (err) {
        throw new DatabaseError(
          `Query failed: ${err instanceof Error ? err.message : String(err)}`,
          'DB_002',
          err instanceof Error ? err : undefined,
        );
      }
    },

    async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
      let client: pg.PoolClient;
      try {
        client = await pool.connect();
      } catch (err) {
        throw new DatabaseError(
          `Failed to acquire client from pool for ${maskConnectionUrl(url)}: ${err instanceof Error ? err.message : String(err)}`,
          'DB_001',
          err instanceof Error ? err : undefined,
        );
      }

      try {
        return await fn(client as unknown as PoolClient);
      } finally {
        client.release();
      }
    },

    async end(): Promise<void> {
      await pool.end();
    },
  };

  return connectionPool;
}
