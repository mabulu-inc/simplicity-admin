import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ConnectionPool } from '@simplicity-admin/core';
import { defineConfig } from '@simplicity-admin/core';
import { createPool } from '@simplicity-admin/db';
import { bootstrap } from '../src/bootstrap.js';
import bcrypt from 'bcrypt';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

describe('bootstrap', () => {
  let pool: ConnectionPool;
  const testSchema = 'bootstrap_test';

  const config = defineConfig({
    database: TEST_URL,
    schema: testSchema,
    systemSchema: testSchema,
  });

  beforeAll(async () => {
    pool = createPool(TEST_URL);

    // Clean slate
    await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

    // Clean up roles (ignore errors if they don't exist)
    for (const role of ['app_admin', 'app_editor', 'app_viewer', 'anon', 'authenticator']) {
      try {
        await pool.query(`DROP ROLE IF EXISTS ${role}`);
      } catch {
        // Role may not exist or may be referenced elsewhere — ignore
      }
    }

    await pool.end();
  });

  it('creates system schema on fresh DB', async () => {
    await bootstrap(pool, config);

    // Verify schema exists
    const schemas = await pool.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [testSchema],
    );
    expect(schemas.rows.length).toBe(1);

    // Verify tables exist
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [testSchema],
    );
    const tableNames = tables.rows.map((r) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('tenants');
    expect(tableNames).toContain('memberships');
  });

  it('creates users table with correct columns', async () => {
    const cols = await pool.query<{ column_name: string }>(
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
    const cols = await pool.query<{ column_name: string }>(
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
    const cols = await pool.query<{ column_name: string }>(
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
    const funcs = await pool.query<{ routine_name: string }>(
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
    const tenants = await pool.query<{ name: string; slug: string }>(
      `SELECT name, slug FROM ${testSchema}.tenants`,
    );
    expect(tenants.rows.length).toBeGreaterThanOrEqual(1);
    const defaultTenant = tenants.rows.find((r) => r.name === 'Default');
    expect(defaultTenant).toBeDefined();
    expect(defaultTenant!.slug).toBe('default');
  });

  it('creates default admin user', async () => {
    const users = await pool.query<{
      email: string;
      password_hash: string;
      super_admin: boolean;
    }>(`SELECT email, password_hash, super_admin FROM ${testSchema}.users`);

    expect(users.rows.length).toBeGreaterThanOrEqual(1);
    const admin = users.rows.find((r) => r.email === 'admin@localhost');
    expect(admin).toBeDefined();
    expect(admin!.super_admin).toBe(true);

    // Verify password is bcrypt hash of 'changeme'
    const passwordValid = await bcrypt.compare('changeme', admin!.password_hash);
    expect(passwordValid).toBe(true);
  });

  it('creates membership linking admin to default tenant', async () => {
    const memberships = await pool.query<{ role: string; email: string; tenant_name: string }>(
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
    // bootstrap was already called in the first test; call again
    await expect(bootstrap(pool, config)).resolves.not.toThrow();

    // Still only one default tenant and one admin
    const tenants = await pool.query<{ name: string }>(
      `SELECT name FROM ${testSchema}.tenants WHERE name = 'Default'`,
    );
    expect(tenants.rows.length).toBe(1);

    const users = await pool.query<{ email: string }>(
      `SELECT email FROM ${testSchema}.users WHERE email = 'admin@localhost'`,
    );
    expect(users.rows.length).toBe(1);
  });
});
