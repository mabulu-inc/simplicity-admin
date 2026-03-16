import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { introspectSchema } from '../src/introspect/index.js';
import { createTestDb, destroyTestDb, type TestDb } from '../../../test-support/test-db.js';

describe('introspectSchema', () => {
  let testDb: TestDb;
  const testSchema = 'introspect_full_test';

  beforeAll(async () => {
    testDb = await createTestDb();

    await testDb.pool.query(`CREATE SCHEMA ${testSchema}`);
    await testDb.pool.query(`CREATE TYPE ${testSchema}.article_status AS ENUM ('draft', 'review', 'published')`);

    await testDb.pool.query(`
      CREATE TABLE ${testSchema}.authors (
        id serial PRIMARY KEY,
        name text NOT NULL,
        email varchar(255) UNIQUE
      )
    `);
    await testDb.pool.query(`COMMENT ON TABLE ${testSchema}.authors IS 'Article authors'`);

    await testDb.pool.query(`
      CREATE TABLE ${testSchema}.articles (
        id serial PRIMARY KEY,
        title text NOT NULL,
        status ${testSchema}.article_status NOT NULL DEFAULT 'draft',
        author_id integer NOT NULL REFERENCES ${testSchema}.authors(id),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await testDb.pool.query(`
      CREATE TABLE ${testSchema}.tags (
        id serial PRIMARY KEY,
        label text NOT NULL UNIQUE
      )
    `);

    await testDb.pool.query(`
      CREATE TABLE ${testSchema}.article_tags (
        article_id integer NOT NULL REFERENCES ${testSchema}.articles(id),
        tag_id integer NOT NULL REFERENCES ${testSchema}.tags(id),
        PRIMARY KEY (article_id, tag_id)
      )
    `);
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('returns a complete SchemaMeta', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);

    expect(schema).toBeDefined();
    expect(schema.tables).toBeInstanceOf(Array);
    expect(schema.relations).toBeInstanceOf(Array);
    expect(schema.enums).toBeInstanceOf(Array);
  });

  it('includes all tables', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);
    const tableNames = schema.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(['article_tags', 'articles', 'authors', 'tags']);
  });

  it('populates columns on each table', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);

    const authors = schema.tables.find((t) => t.name === 'authors');
    expect(authors).toBeDefined();
    expect(authors!.columns.length).toBeGreaterThan(0);
    expect(authors!.columns.map((c) => c.name).sort()).toEqual(['email', 'id', 'name']);
    expect(authors!.primaryKey).toEqual(['id']);
    expect(authors!.comment).toBe('Article authors');
  });

  it('populates primary keys including composite', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);

    const articleTags = schema.tables.find((t) => t.name === 'article_tags');
    expect(articleTags).toBeDefined();
    expect(articleTags!.primaryKey.sort()).toEqual(['article_id', 'tag_id']);
  });

  it('includes relations in both directions', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);

    const manyToOne = schema.relations.filter((r) => r.type === 'many-to-one');
    const oneToMany = schema.relations.filter((r) => r.type === 'one-to-many');

    expect(manyToOne.length).toBeGreaterThanOrEqual(1);
    expect(oneToMany.length).toBeGreaterThanOrEqual(1);

    const articlesToAuthors = manyToOne.find(
      (r) => r.fromTable === 'articles' && r.toTable === 'authors',
    );
    expect(articlesToAuthors).toBeDefined();
    expect(articlesToAuthors!.fromColumns).toEqual(['author_id']);
    expect(articlesToAuthors!.toColumns).toEqual(['id']);

    const authorsToArticles = oneToMany.find(
      (r) => r.fromTable === 'authors' && r.toTable === 'articles',
    );
    expect(authorsToArticles).toBeDefined();
  });

  it('includes enums', async () => {
    const schema = await introspectSchema(testDb.pool, testSchema);

    expect(schema.enums.length).toBeGreaterThanOrEqual(1);
    const articleStatus = schema.enums.find((e) => e.name === 'article_status');
    expect(articleStatus).toBeDefined();
    expect(articleStatus!.values).toEqual(['draft', 'review', 'published']);
    expect(articleStatus!.schema).toBe(testSchema);
  });

  it('defaults to public schema', async () => {
    const schema = await introspectSchema(testDb.pool);
    expect(schema).toBeDefined();
    expect(schema.tables).toBeInstanceOf(Array);
    expect(schema.relations).toBeInstanceOf(Array);
    expect(schema.enums).toBeInstanceOf(Array);
  });

  it('handles schema with no tables', async () => {
    const emptySchema = 'introspect_full_empty';
    await testDb.pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
    await testDb.pool.query(`CREATE SCHEMA ${emptySchema}`);

    try {
      const schema = await introspectSchema(testDb.pool, emptySchema);
      expect(schema.tables).toEqual([]);
      expect(schema.relations).toEqual([]);
      expect(schema.enums).toEqual([]);
    } finally {
      await testDb.pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
    }
  });
});
