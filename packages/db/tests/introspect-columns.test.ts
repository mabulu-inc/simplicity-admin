import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { introspectColumns } from '../src/introspect/columns.js';
import { createTestDb, destroyTestDb, type TestDb } from '@simplicity-admin/test-support';

const TEST_SCHEMA = 'test_introspect_columns';

describe('introspectColumns', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();

    await testDb.pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
    await testDb.pool.query(`CREATE TYPE ${TEST_SCHEMA}.article_status AS ENUM ('draft', 'review', 'published')`);
    await testDb.pool.query(`
      CREATE TABLE ${TEST_SCHEMA}.contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email varchar(255),
        active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      )
    `);
    await testDb.pool.query(`COMMENT ON COLUMN ${TEST_SCHEMA}.contacts.name IS 'Full name of the contact'`);
    await testDb.pool.query(`
      CREATE TABLE ${TEST_SCHEMA}.articles (
        id serial PRIMARY KEY,
        title text NOT NULL,
        status ${TEST_SCHEMA}.article_status DEFAULT 'draft',
        price numeric(10,2),
        first_name text NOT NULL,
        last_name text NOT NULL,
        full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
        tags text[]
      )
    `);
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('returns correct column names for contacts table', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const names = columns.map((c) => c.name);
    expect(names).toEqual(['id', 'name', 'email', 'active', 'created_at']);
  });

  it('maps column types correctly', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const typeMap = Object.fromEntries(columns.map((c) => [c.name, c.type]));
    expect(typeMap).toEqual({
      id: 'uuid',
      name: 'text',
      email: 'varchar',
      active: 'boolean',
      created_at: 'timestamptz',
    });
  });

  it('detects nullable and non-nullable columns', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const nullMap = Object.fromEntries(columns.map((c) => [c.name, c.nullable]));
    expect(nullMap).toEqual({
      id: false,
      name: false,
      email: true,
      active: true,
      created_at: true,
    });
  });

  it('detects columns with defaults', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const defaultMap = Object.fromEntries(columns.map((c) => [c.name, c.hasDefault]));
    expect(defaultMap).toEqual({
      id: true,
      name: false,
      email: false,
      active: true,
      created_at: true,
    });
  });

  it('detects primary key columns', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const pkMap = Object.fromEntries(columns.map((c) => [c.name, c.isPrimaryKey]));
    expect(pkMap).toEqual({
      id: true,
      name: false,
      email: false,
      active: false,
      created_at: false,
    });
  });

  it('handles varchar(N) maxLength', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const email = columns.find((c) => c.name === 'email');
    expect(email).toBeDefined();
    expect(email!.maxLength).toBe(255);
  });

  it('detects enum columns with values', async () => {
    const columns = await introspectColumns(testDb.pool, 'articles', TEST_SCHEMA);
    const status = columns.find((c) => c.name === 'status');
    expect(status).toBeDefined();
    expect(status!.type).toBe('enum');
    expect(status!.enumValues).toEqual(['draft', 'review', 'published']);
  });

  it('detects generated columns', async () => {
    const columns = await introspectColumns(testDb.pool, 'articles', TEST_SCHEMA);
    const fullName = columns.find((c) => c.name === 'full_name');
    expect(fullName).toBeDefined();
    expect(fullName!.isGenerated).toBe(true);

    const title = columns.find((c) => c.name === 'title');
    expect(title!.isGenerated).toBe(false);
  });

  it('handles numeric(P,S) precision and scale', async () => {
    const columns = await introspectColumns(testDb.pool, 'articles', TEST_SCHEMA);
    const price = columns.find((c) => c.name === 'price');
    expect(price).toBeDefined();
    expect(price!.type).toBe('numeric');
    expect(price!.precision).toBe(10);
    expect(price!.scale).toBe(2);
  });

  it('detects array columns', async () => {
    const columns = await introspectColumns(testDb.pool, 'articles', TEST_SCHEMA);
    const tags = columns.find((c) => c.name === 'tags');
    expect(tags).toBeDefined();
    expect(tags!.type).toBe('array');
  });

  it('includes column comments', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const name = columns.find((c) => c.name === 'name');
    expect(name!.comment).toBe('Full name of the contact');

    const email = columns.find((c) => c.name === 'email');
    expect(email!.comment).toBeNull();
  });

  it('preserves raw pgType', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts', TEST_SCHEMA);
    const id = columns.find((c) => c.name === 'id');
    expect(id!.pgType).toBe('uuid');
  });

  it('defaults to public schema', async () => {
    const columns = await introspectColumns(testDb.pool, 'contacts');
    expect(columns).toEqual([]);
  });

  it('detects serial columns as having defaults', async () => {
    const columns = await introspectColumns(testDb.pool, 'articles', TEST_SCHEMA);
    const id = columns.find((c) => c.name === 'id');
    expect(id).toBeDefined();
    expect(id!.hasDefault).toBe(true);
    expect(id!.isPrimaryKey).toBe(true);
  });
});
