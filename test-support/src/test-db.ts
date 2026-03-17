import { randomUUID } from 'node:crypto';
import { createPool } from '@mabulu-inc/simplicity-admin-db';
import type { ConnectionPool } from '@mabulu-inc/simplicity-admin-core';

const DEFAULT_URL = process.env['DATABASE_URL'] ?? 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

export interface TestDb {
  /** A connection pool connected to the isolated test database */
  pool: ConnectionPool;
  /** The name of the test database */
  name: string;
  /** Full connection URL for the test database */
  url: string;
}

/**
 * Create an isolated test database with a unique name.
 * Returns a pool connected to the new database, plus metadata.
 *
 * Use in beforeEach/afterEach for per-test isolation:
 * ```ts
 * let testDb: TestDb;
 * beforeEach(async () => { testDb = await createTestDb(); });
 * afterEach(async () => { await destroyTestDb(testDb); });
 * ```
 */
export async function createTestDb(): Promise<TestDb> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const dbName = `test_${suffix}`;

  // Parse the base URL to extract connection params
  const baseUrl = new URL(DEFAULT_URL);
  const adminPool = createPool(DEFAULT_URL);

  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminPool.end();
  }

  // Build a URL pointing at the new database
  const testUrl = `${baseUrl.protocol}//${baseUrl.username}:${baseUrl.password}@${baseUrl.host}/${dbName}`;
  const pool = createPool(testUrl);

  return { pool, name: dbName, url: testUrl };
}

/**
 * Destroy an isolated test database.
 * Ends the pool and drops the database.
 */
export async function destroyTestDb(testDb: TestDb): Promise<void> {
  // End the test pool first so no connections remain
  await testDb.pool.end();

  // Connect to the admin database to drop the test database
  const adminPool = createPool(DEFAULT_URL);

  try {
    // Terminate any remaining connections
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDb.name],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${testDb.name}"`);
  } finally {
    await adminPool.end();
  }
}
