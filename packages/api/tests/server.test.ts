import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { defineConfig } from '@simplicity-admin/core';
import { createAPIServer } from '../src/server.js';
import { createTestDb, destroyTestDb, type TestDb } from '../../../test-support/test-db.js';

describe('API server', () => {
  let testDb: TestDb;
  let server: Server;
  let port: number;
  let closeServer: () => Promise<void>;
  const testSchema = 'api_server_test';

  beforeAll(async () => {
    testDb = await createTestDb();

    await testDb.pool.query(`CREATE SCHEMA ${testSchema}`);
    await testDb.pool.query(`
      CREATE TABLE ${testSchema}.contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text,
        created_at timestamptz DEFAULT now()
      )
    `);

    const config = defineConfig({
      database: testDb.url,
      schema: testSchema,
      api: { graphiql: true },
    });

    const result = await createAPIServer(testDb.pool, { tables: [], relations: [], enums: [] }, config);
    closeServer = result.close;

    server = createServer(result.handler);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeServer();
    await destroyTestDb(testDb);
  });

  async function graphql(query: string, variables?: Record<string, unknown>) {
    const res = await fetch(`http://localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await res.json();
    if (body.errors) {
      console.error('GraphQL errors:', JSON.stringify(body.errors, null, 2));
    }
    return { status: res.status, body };
  }

  it('POST to /graphql executes a query and returns results', async () => {
    const { status, body } = await graphql(`{ allContacts { nodes { id name } } }`);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.allContacts.nodes).toEqual([]);
  });

  it('creates a record via mutation', async () => {
    const { body } = await graphql(`
      mutation {
        createContact(input: { contact: { name: "Alice", email: "alice@test.com" } }) {
          contact { id name email }
        }
      }
    `);
    expect(body.data.createContact.contact.name).toBe('Alice');
    expect(body.data.createContact.contact.email).toBe('alice@test.com');
    expect(body.data.createContact.contact.id).toBeDefined();
  });

  it('queries created records', async () => {
    const { body } = await graphql(`{ allContacts { nodes { id name email } } }`);
    expect(body.data.allContacts.nodes.length).toBeGreaterThanOrEqual(1);
    const alice = body.data.allContacts.nodes.find(
      (n: Record<string, unknown>) => n.name === 'Alice',
    );
    expect(alice).toBeDefined();
    expect(alice.email).toBe('alice@test.com');
  });

  it('updates a record via mutation', async () => {
    const { body: listBody } = await graphql(`{ allContacts { nodes { rowId name } } }`);
    const alice = listBody.data.allContacts.nodes.find(
      (n: Record<string, unknown>) => n.name === 'Alice',
    );

    const { body } = await graphql(`
      mutation UpdateContact($id: UUID!, $patch: ContactPatch!) {
        updateContactByRowId(input: { rowId: $id, contactPatch: $patch }) {
          contact { rowId name email }
        }
      }
    `, { id: alice.rowId, patch: { name: 'Alice Updated' } });

    expect(body.data.updateContactByRowId.contact.name).toBe('Alice Updated');
  });

  it('deletes a record via mutation', async () => {
    const { body: listBody } = await graphql(`{ allContacts { nodes { rowId name } } }`);
    const alice = listBody.data.allContacts.nodes.find(
      (n: Record<string, unknown>) => n.name === 'Alice Updated',
    );

    const { body } = await graphql(`
      mutation DeleteContact($id: UUID!) {
        deleteContactByRowId(input: { rowId: $id }) {
          contact { rowId name }
        }
      }
    `, { id: alice.rowId });

    expect(body.data.deleteContactByRowId.contact.name).toBe('Alice Updated');

    const { body: afterBody } = await graphql(`{ allContacts { nodes { rowId } } }`);
    const deleted = afterBody.data.allContacts.nodes.find(
      (n: Record<string, unknown>) => n.rowId === alice.rowId,
    );
    expect(deleted).toBeUndefined();
  });

  it('GraphiQL is available in dev mode', async () => {
    const res = await fetch(`http://localhost:${port}/graphql`, {
      method: 'GET',
      headers: { Accept: 'text/html' },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('html');
  });
});
