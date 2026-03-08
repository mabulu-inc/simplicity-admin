import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool } from '@simplicity-admin/db';
import { introspectRelations } from '../src/introspect/relations.js';
import type { ConnectionPool } from '@simplicity-admin/core';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';
const TEST_SCHEMA = 'test_introspect_relations';

describe('introspectRelations', () => {
  let pool: ConnectionPool;

  beforeAll(async () => {
    pool = createPool(TEST_URL);

    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${TEST_SCHEMA}`);

    // Create tables with foreign key relationships
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL
    )`);

    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.deals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text,
      contact_id uuid REFERENCES ${TEST_SCHEMA}.contacts(id)
    )`);

    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.activities (
      id serial PRIMARY KEY,
      description text,
      deal_id uuid REFERENCES ${TEST_SCHEMA}.deals(id),
      contact_id uuid REFERENCES ${TEST_SCHEMA}.contacts(id)
    )`);

    // Self-referencing FK
    await pool.query(`CREATE TABLE ${TEST_SCHEMA}.categories (
      id serial PRIMARY KEY,
      name text NOT NULL,
      parent_id integer REFERENCES ${TEST_SCHEMA}.categories(id)
    )`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.end();
  });

  it('detects FK constraints as many-to-one relations', async () => {
    const relations = await introspectRelations(pool, TEST_SCHEMA);
    const manyToOne = relations.filter((r) => r.type === 'many-to-one');

    // deals.contact_id -> contacts.id
    const dealsToContacts = manyToOne.find(
      (r) => r.fromTable === 'deals' && r.toTable === 'contacts',
    );
    expect(dealsToContacts).toBeDefined();
    expect(dealsToContacts!.fromColumns).toEqual(['contact_id']);
    expect(dealsToContacts!.toColumns).toEqual(['id']);
  });

  it('produces one-to-many reverse for each FK', async () => {
    const relations = await introspectRelations(pool, TEST_SCHEMA);
    const oneToMany = relations.filter((r) => r.type === 'one-to-many');

    // contacts -> deals (reverse of deals.contact_id)
    const contactsToDeals = oneToMany.find(
      (r) => r.fromTable === 'contacts' && r.toTable === 'deals',
    );
    expect(contactsToDeals).toBeDefined();
    expect(contactsToDeals!.fromColumns).toEqual(['id']);
    expect(contactsToDeals!.toColumns).toEqual(['contact_id']);
  });

  it('handles multiple FKs from same table', async () => {
    const relations = await introspectRelations(pool, TEST_SCHEMA);
    const activityManyToOne = relations.filter(
      (r) => r.fromTable === 'activities' && r.type === 'many-to-one',
    );

    expect(activityManyToOne).toHaveLength(2);
    const targets = activityManyToOne.map((r) => r.toTable).sort();
    expect(targets).toEqual(['contacts', 'deals']);
  });

  it('handles self-referencing FKs', async () => {
    const relations = await introspectRelations(pool, TEST_SCHEMA);

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
    const relations = await introspectRelations(pool, TEST_SCHEMA);
    for (const rel of relations) {
      expect(rel.name).toBeTruthy();
      expect(typeof rel.name).toBe('string');
    }
  });

  it('defaults to public schema', async () => {
    const relations = await introspectRelations(pool);
    // Should not include our test schema relations
    for (const rel of relations) {
      expect(rel.fromTable).not.toBe('deals');
    }
  });

  it('returns empty array for schema with no FKs', async () => {
    const emptySchema = `${TEST_SCHEMA}_empty`;
    await pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
    await pool.query(`CREATE SCHEMA ${emptySchema}`);
    await pool.query(`CREATE TABLE ${emptySchema}.standalone (id serial PRIMARY KEY, name text)`);

    const relations = await introspectRelations(pool, emptySchema);
    expect(relations).toEqual([]);

    await pool.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
  });

  it('produces both directions for every FK (total count check)', async () => {
    const relations = await introspectRelations(pool, TEST_SCHEMA);
    // 4 FKs (deals->contacts, activities->deals, activities->contacts, categories->categories)
    // Each produces 2 directions = 8 total
    expect(relations).toHaveLength(8);

    const manyToOne = relations.filter((r) => r.type === 'many-to-one');
    const oneToMany = relations.filter((r) => r.type === 'one-to-many');
    expect(manyToOne).toHaveLength(4);
    expect(oneToMany).toHaveLength(4);
  });
});
