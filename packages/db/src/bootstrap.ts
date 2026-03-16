import type { ConnectionPool, ProjectConfig } from '@simplicity-admin/core';
import { DatabaseError } from './errors.js';
import { escapeIdentifier } from './escape.js';
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

/**
 * Bootstraps the system schema on a fresh or existing database.
 * Creates tables, roles, functions, indexes, constraints, and seed data.
 * Idempotent — safe to run multiple times.
 */
export async function bootstrap(pool: ConnectionPool, config: ProjectConfig): Promise<void> {
  const schema = config.systemSchema ?? config.schema ?? 'public';

  try {
    // 1. Create schema
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${escapeIdentifier(schema)}`);

    // 2. Create roles (idempotent via DO block)
    await createRoles(pool);

    // 3. Create functions
    await createFunctions(pool, schema);

    // 4. Create tables
    await createTables(pool, schema);

    // 5. Create indexes
    await createIndexes(pool, schema);

    // 6. Create triggers
    await createTriggers(pool, schema);

    // 7. Set up grants
    await createGrants(pool, schema);

    // 8. Seed default data
    await seedDefaults(pool, schema);
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Bootstrap failed: ${err instanceof Error ? err.message : String(err)}`,
      'DB_004',
      err instanceof Error ? err : undefined,
    );
  }
}


async function createRoles(pool: ConnectionPool): Promise<void> {
  // Create roles if they don't exist (no IF NOT EXISTS for CREATE ROLE in PG < 16)
  const roles = [
    { name: 'anon', login: false, inherit: false },
    { name: 'app_viewer', login: false, inherit: true },
    { name: 'app_editor', login: false, inherit: true },
    { name: 'app_admin', login: false, inherit: true },
    { name: 'authenticator', login: true, inherit: true },
  ];

  for (const role of roles) {
    const loginClause = role.login ? 'LOGIN' : 'NOLOGIN';
    const inheritClause = role.inherit ? 'INHERIT' : 'NOINHERIT';
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role.name}') THEN
          CREATE ROLE ${escapeIdentifier(role.name)} ${loginClause} ${inheritClause};
        END IF;
      END $$;
    `);
  }

  // Grant membership: authenticator is member of all functional roles
  for (const role of ['anon', 'app_viewer', 'app_editor', 'app_admin']) {
    await pool.query(`GRANT ${escapeIdentifier(role)} TO ${escapeIdentifier('authenticator')}`);
  }
}

async function createFunctions(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  await pool.query(`
    CREATE OR REPLACE FUNCTION ${s}.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT current_setting('app.user_id')::uuid;
    $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION ${s}.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT current_setting('app.tenant_id')::uuid;
    $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION ${s}.begin_session(
      p_role text,
      p_user_id text,
      p_tenant_id text DEFAULT '',
      p_is_super_admin text DEFAULT 'false'
    ) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      EXECUTE format('SET LOCAL role %I', p_role);
      PERFORM set_config('app.user_id', p_user_id, true);
      IF p_tenant_id <> '' THEN
        PERFORM set_config('app.tenant_id', p_tenant_id, true);
      END IF;
      PERFORM set_config('app.is_super_admin', p_is_super_admin, true);
    END;
    $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION ${s}.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  `);
}

async function createTables(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      display_name text,
      super_admin boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Tenants table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.tenants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$')
    );
  `);

  // Memberships table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${s}.memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES ${s}.users(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_memberships_role_valid CHECK (role IN ('app_viewer', 'app_editor', 'app_admin'))
    );
  `);
}

async function createIndexes(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON ${s}.users (email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tenants_slug ON ${s}.tenants (slug)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_unique ON ${s}.memberships (user_id, tenant_id, role)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_memberships_user ON ${s}.memberships (user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON ${s}.memberships (tenant_id)`);
}

async function createTriggers(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  for (const table of ['users', 'tenants', 'memberships']) {
    const triggerName = `set_${table}_updated_at`;
    // DROP + CREATE since CREATE OR REPLACE TRIGGER requires PG 14+
    await pool.query(`
      DROP TRIGGER IF EXISTS ${escapeIdentifier(triggerName)} ON ${s}.${escapeIdentifier(table)};
      CREATE TRIGGER ${escapeIdentifier(triggerName)}
        BEFORE UPDATE ON ${s}.${escapeIdentifier(table)}
        FOR EACH ROW
        WHEN (OLD.* IS DISTINCT FROM NEW.*)
        EXECUTE FUNCTION ${s}.update_timestamp();
    `);
  }
}

async function createGrants(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  // Schema usage
  await pool.query(`GRANT USAGE ON SCHEMA ${s} TO anon, app_viewer, app_editor, app_admin, authenticator`);

  // Users table grants
  await pool.query(`GRANT SELECT (id, email, display_name, active) ON ${s}.users TO app_viewer, app_editor`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${s}.users TO app_admin`);

  // Tenants table grants
  await pool.query(`GRANT SELECT (id, name, slug) ON ${s}.tenants TO app_viewer, app_editor`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${s}.tenants TO app_admin`);

  // Memberships table grants
  await pool.query(`GRANT SELECT ON ${s}.memberships TO app_viewer, app_editor`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${s}.memberships TO app_admin`);

  // Function execution grants
  await pool.query(`GRANT EXECUTE ON FUNCTION ${s}.current_user_id() TO anon, app_viewer, app_editor, app_admin`);
  await pool.query(`GRANT EXECUTE ON FUNCTION ${s}.current_tenant_id() TO anon, app_viewer, app_editor, app_admin`);
  await pool.query(`GRANT EXECUTE ON FUNCTION ${s}.begin_session(text, text, text, text) TO authenticator`);
}

async function seedDefaults(pool: ConnectionPool, schema: string): Promise<void> {
  const s = escapeIdentifier(schema);

  // Insert default tenant (idempotent via ON CONFLICT)
  await pool.query(`
    INSERT INTO ${s}.tenants (name, slug)
    VALUES ('Default', 'default')
    ON CONFLICT (slug) DO NOTHING;
  `);

  // Insert default admin user (idempotent via ON CONFLICT)
  const passwordHash = await bcrypt.hash('changeme', BCRYPT_COST);
  await pool.query(`
    INSERT INTO ${s}.users (email, password_hash, super_admin)
    VALUES ('admin@localhost', $1, true)
    ON CONFLICT (email) DO NOTHING;
  `, [passwordHash]);

  // Create membership linking admin to default tenant
  await pool.query(`
    INSERT INTO ${s}.memberships (user_id, tenant_id, role)
    SELECT u.id, t.id, 'app_admin'
    FROM ${s}.users u, ${s}.tenants t
    WHERE u.email = 'admin@localhost' AND t.slug = 'default'
    AND NOT EXISTS (
      SELECT 1 FROM ${s}.memberships m
      WHERE m.user_id = u.id AND m.tenant_id = t.id AND m.role = 'app_admin'
    );
  `);
}
