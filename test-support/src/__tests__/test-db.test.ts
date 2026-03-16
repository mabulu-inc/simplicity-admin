import { describe, it, expect, afterAll } from 'vitest';
import { createTestDb, destroyTestDb, type TestDb } from '../test-db.js';

describe('createTestDb / destroyTestDb', () => {
  const testDbs: TestDb[] = [];

  afterAll(async () => {
    for (const db of testDbs) {
      try {
        await destroyTestDb(db);
      } catch {
        // cleanup best-effort
      }
    }
  });

  it('creates an isolated database with a working pool', async () => {
    const db = await createTestDb();
    testDbs.push(db);

    expect(db.pool).toBeDefined();
    expect(db.name).toMatch(/^test_/);
    expect(db.url).toContain(db.name);

    const result = await db.pool.query<{ val: number }>('SELECT 1 AS val');
    expect(result.rows[0].val).toBe(1);
  });

  it('creates unique databases on each call', async () => {
    const db1 = await createTestDb();
    const db2 = await createTestDb();
    testDbs.push(db1, db2);

    expect(db1.name).not.toBe(db2.name);
  });

  it('databases are fully isolated — writes in one are invisible to the other', async () => {
    const db1 = await createTestDb();
    const db2 = await createTestDb();
    testDbs.push(db1, db2);

    await db1.pool.query('CREATE TABLE isolation_check (id serial PRIMARY KEY)');
    await db1.pool.query('INSERT INTO isolation_check DEFAULT VALUES');

    // db2 should not have this table
    const result = await db2.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'isolation_check'
      ) AS exists`,
    );
    expect(result.rows[0].exists).toBe(false);
  });

  it('destroyTestDb cleans up the database', async () => {
    const db = await createTestDb();
    const dbName = db.name;

    await destroyTestDb(db);

    // Connect to default database and verify the test db was dropped
    const checkDb = await createTestDb();
    testDbs.push(checkDb);

    const result = await checkDb.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_database WHERE datname = $1
      ) AS exists`,
      [dbName],
    );
    expect(result.rows[0].exists).toBe(false);
  });
});
