import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ConnectionPool } from '@mabulu-inc/simplicity-admin-core';
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';
import { bootstrap } from '../src/bootstrap.js';
import bcrypt from 'bcrypt';
import { createTestDb, destroyTestDb, type TestDb } from '@mabulu-inc/simplicity-admin-test-support';

describe('bootstrap', () => {
  let testDb: TestDb;
  const testSchema = 'public';

  beforeAll(async () => {
    testDb = await createTestDb();

    const config = defineConfig({
      database: testDb.url,
      schema: testSchema,
      systemSchema: testSchema,
    });

    await bootstrap(testDb.pool, config);
  });

  afterAll(async () => {
    await destroyTestDb(testDb);
  });

  it('creates core system tables', async () => {
    const tables = await testDb.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [testSchema],
    );
    const tableNames = tables.rows.map((r) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('tenants');
    expect(tableNames).toContain('memberships');
  });

  it('creates all schema-defined tables via simplicity-schema', async () => {
    const tables = await testDb.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [testSchema],
    );
    const tableNames = tables.rows.map((r) => r.table_name);
    // These tables exist in the YAML schema but were NOT in the old hand-written DDL
    expect(tableNames).toContain('simplicity_permission_overrides');
    expect(tableNames).toContain('simplicity_dashboards');
    expect(tableNames).toContain('simplicity_notification_rules');
    expect(tableNames).toContain('simplicity_notifications');
    expect(tableNames).toContain('simplicity_state_machines');
    expect(tableNames).toContain('simplicity_transition_log');
    expect(tableNames).toContain('simplicity_widgets');
  });

  it('creates users table with correct columns', async () => {
    const cols = await testDb.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'users' ORDER BY ordinal_position`,
      [testSchema],
    );
    const colNames = cols.rows.map((r) => r.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
    expect(colNames).toContain('password_hash');
    expect(colNames).toContain('display_name');
    expect(colNames).toContain('super_admin');
    expect(colNames).toContain('active');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  it('creates tenants table with correct columns', async () => {
    const cols = await testDb.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'tenants' ORDER BY ordinal_position`,
      [testSchema],
    );
    const colNames = cols.rows.map((r) => r.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('slug');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  it('creates memberships table with correct columns', async () => {
    const cols = await testDb.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'memberships' ORDER BY ordinal_position`,
      [testSchema],
    );
    const colNames = cols.rows.map((r) => r.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('tenant_id');
    expect(colNames).toContain('role');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  it('creates database functions', async () => {
    const funcs = await testDb.pool.query<{ routine_name: string }>(
      `SELECT routine_name FROM information_schema.routines WHERE routine_schema = $1 ORDER BY routine_name`,
      [testSchema],
    );
    const funcNames = funcs.rows.map((r) => r.routine_name);
    expect(funcNames).toContain('current_user_id');
    expect(funcNames).toContain('current_tenant_id');
    expect(funcNames).toContain('begin_session');
    expect(funcNames).toContain('update_timestamp');
  });

  it('creates default tenant', async () => {
    const tenants = await testDb.pool.query<{ name: string; slug: string }>(
      `SELECT name, slug FROM ${testSchema}.tenants`,
    );
    expect(tenants.rows.length).toBeGreaterThanOrEqual(1);
    const defaultTenant = tenants.rows.find((r) => r.name === 'Default');
    expect(defaultTenant).toBeDefined();
    expect(defaultTenant!.slug).toBe('default');
  });

  it('creates default admin user', async () => {
    const users = await testDb.pool.query<{
      email: string;
      password_hash: string;
      super_admin: boolean;
    }>(`SELECT email, password_hash, super_admin FROM ${testSchema}.users`);

    expect(users.rows.length).toBeGreaterThanOrEqual(1);
    const admin = users.rows.find((r) => r.email === 'admin@localhost');
    expect(admin).toBeDefined();
    expect(admin!.super_admin).toBe(true);

    const passwordValid = await bcrypt.compare('changeme', admin!.password_hash);
    expect(passwordValid).toBe(true);
  });

  it('creates membership linking admin to default tenant', async () => {
    const memberships = await testDb.pool.query<{ role: string; email: string; tenant_name: string }>(
      `SELECT m.role, u.email, t.name as tenant_name
       FROM ${testSchema}.memberships m
       JOIN ${testSchema}.users u ON m.user_id = u.id
       JOIN ${testSchema}.tenants t ON m.tenant_id = t.id`,
    );

    const adminMembership = memberships.rows.find(
      (r) => r.email === 'admin@localhost' && r.tenant_name === 'Default',
    );
    expect(adminMembership).toBeDefined();
    expect(adminMembership!.role).toBe('app_admin');
  });

  it('is idempotent — running twice is safe', async () => {
    const config = defineConfig({
      database: testDb.url,
      schema: testSchema,
      systemSchema: testSchema,
    });

    await expect(bootstrap(testDb.pool, config)).resolves.not.toThrow();

    const tenants = await testDb.pool.query<{ name: string }>(
      `SELECT name FROM ${testSchema}.tenants WHERE name = 'Default'`,
    );
    expect(tenants.rows.length).toBe(1);

    const users = await testDb.pool.query<{ email: string }>(
      `SELECT email FROM ${testSchema}.users WHERE email = 'admin@localhost'`,
    );
    expect(users.rows.length).toBe(1);
  });

  it('wraps errors in DatabaseError', async () => {
    const badPool: ConnectionPool = {
      query: () => Promise.reject(new Error('connection refused')),
      withClient: () => Promise.reject(new Error('connection refused')),
      end: () => Promise.resolve(),
    };

    const config = defineConfig({
      database: 'postgres://bad:bad@localhost:1/nope',
      schema: testSchema,
      systemSchema: testSchema,
    });

    await expect(bootstrap(badPool, config)).rejects.toThrow(/Bootstrap failed/);
  });
});
