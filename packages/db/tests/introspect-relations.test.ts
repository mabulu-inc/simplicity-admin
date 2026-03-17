import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { introspectRelations } from '../src/introspect/relations.js';
import { createTestDb, destroyTestDb, type TestDb } from '@mabulu-inc/simplicity-admin-test-support';

const TEST_SCHEMA = 'test_introspect_relations';

describe('introspectRelations', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();

    await testDb.pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);

    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL
    )`);

    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.deals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text,
      contact_id uuid REFERENCES ${TEST_SCHEMA}.contacts(id)
    )`);

    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.activities (
      id serial PRIMARY KEY,
      description text,
      deal_id uuid REFERENCES ${TEST_SCHEMA}.deals(id),
      contact_id uuid REFERENCES ${TEST_SCHEMA}.contacts(id)
    )`);

    await testDb.pool.query(`CREATE TABLE ${TEST_SCHEMA}.categories (
      id serial PRIMARY KEY,
      name text NOT NULL,
      parent_id integer REFERENCES ${TEST_SCHEMA}.categories(id)
    )`);
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('detects FK constraints as many-to-one relations', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);
    const manyToOne = relations.filter((r) => r.type === 'many-to-one');

    const dealsToContacts = manyToOne.find(
      (r) => r.fromTable === 'deals' && r.toTable === 'contacts',
    );
    expect(dealsToContacts).toBeDefined();
    expect(dealsToContacts!.fromColumns).toEqual(['contact_id']);
    expect(dealsToContacts!.toColumns).toEqual(['id']);
  });

  it('produces one-to-many reverse for each FK', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);
    const oneToMany = relations.filter((r) => r.type === 'one-to-many');

    const contactsToDeals = oneToMany.find(
      (r) => r.fromTable === 'contacts' && r.toTable === 'deals',
    );
    expect(contactsToDeals).toBeDefined();
    expect(contactsToDeals!.fromColumns).toEqual(['id']);
    expect(contactsToDeals!.toColumns).toEqual(['contact_id']);
  });

  it('handles multiple FKs from same table', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);
    const activityManyToOne = relations.filter(
      (r) => r.fromTable === 'activities' && r.type === 'many-to-one',
    );

    expect(activityManyToOne).toHaveLength(2);
    const targets = activityManyToOne.map((r) => r.toTable).sort();
    expect(targets).toEqual(['contacts', 'deals']);
  });

  it('handles self-referencing FKs', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);

    const selfRef = relations.find(
      (r) => r.fromTable === 'categories' && r.toTable === 'categories' && r.type === 'many-to-one',
    );
    expect(selfRef).toBeDefined();
    expect(selfRef!.fromColumns).toEqual(['parent_id']);
    expect(selfRef!.toColumns).toEqual(['id']);

    const selfRefReverse = relations.find(
      (r) => r.fromTable === 'categories' && r.toTable === 'categories' && r.type === 'one-to-many',
    );
    expect(selfRefReverse).toBeDefined();
  });

  it('includes constraint name', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);
    for (const rel of relations) {
      expect(rel.name).toBeTruthy();
      expect(typeof rel.name).toBe('string');
    }
  });

  it('defaults to public schema', async () => {
    const relations = await introspectRelations(testDb.pool);
    for (const rel of relations) {
      expect(rel.fromTable).not.toBe('deals');
    }
  });

  it('returns empty array for schema with no FKs', async () => {
    const emptySchema = `${TEST_SCHEMA}_empty`;
    await testDb.pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
    await testDb.pool.query(`CREATE SCHEMA ${emptySchema}`);
    await testDb.pool.query(`CREATE TABLE ${emptySchema}.standalone (id serial PRIMARY KEY, name text)`);

    const relations = await introspectRelations(testDb.pool, emptySchema);
    expect(relations).toEqual([]);

    await testDb.pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
  });

  it('produces both directions for every FK (total count check)', async () => {
    const relations = await introspectRelations(testDb.pool, TEST_SCHEMA);
    expect(relations).toHaveLength(8);

    const manyToOne = relations.filter((r) => r.type === 'many-to-one');
    const oneToMany = relations.filter((r) => r.type === 'one-to-many');
    expect(manyToOne).toHaveLength(4);
    expect(oneToMany).toHaveLength(4);
  });
});
