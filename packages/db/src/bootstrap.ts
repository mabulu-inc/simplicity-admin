import type { ConnectionPool, ProjectConfig } from '@mabulu-inc/simplicity-admin-core';
import { resolveConfig, runAll, createLogger, closePool } from '@mabulu-inc/simplicity-schema';
import { DatabaseError } from './errors.js';
import { escapeIdentifier } from './escape.js';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BCRYPT_COST = 12;

/** Resolve the schema directory relative to this source file. */
function getSchemaDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '..', 'schema');
}

/**
 * Bootstraps the system schema on a fresh or existing database.
 * Delegates DDL to @mabulu-inc/simplicity-schema using YAML schema files,
 * then seeds default data (tenant, admin user, membership).
 * Idempotent — safe to run multiple times.
 */
export async function bootstrap(pool: ConnectionPool, config: ProjectConfig): Promise<void> {
  const schema = config.systemSchema ?? '_simplicity';

  try {
    // 1. Create target schema if it doesn't exist
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${escapeIdentifier(schema)}`);

    // 2. Apply DDL via simplicity-schema (roles, functions, tables, indexes, triggers, grants)
    const schemaConfig = resolveConfig({
      connectionString: config.database,
      baseDir: getSchemaDir(),
      pgSchema: schema,
      quiet: true,
    });

    const logger = createLogger({ verbose: false, quiet: true, json: false });
    await runAll(schemaConfig, logger);
    await closePool();

    // 3. Seed default data
    await seedDefaults(pool, schema);
  } catch (err) {
    // Ensure simplicity-schema pool is cleaned up on error
    await closePool().catch(() => {});

    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Bootstrap failed: ${err instanceof Error ? err.message : String(err)}`,
      'DB_004',
      err instanceof Error ? err : undefined,
    );
  }
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
