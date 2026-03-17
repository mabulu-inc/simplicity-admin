import { resolve } from 'node:path';
import { loadConfig } from '@mabulu-inc/simplicity-admin-core';
import { postgresProvider } from '@mabulu-inc/simplicity-admin-db';
import type { ProjectConfig, ConnectionPool } from '@mabulu-inc/simplicity-admin-core';

/**
 * Parse CLI args for the migrate command.
 * Supports: --schema-dir <dir>, --schema <name>, --allow-destructive
 */
function parseArgs(args: string[]): {
  schemaDir?: string;
  schema?: string;
  allowDestructive: boolean;
} {
  const result: { schemaDir?: string; schema?: string; allowDestructive: boolean } = {
    allowDestructive: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema-dir' && args[i + 1]) {
      result.schemaDir = args[++i];
    } else if (args[i] === '--schema' && args[i + 1]) {
      result.schema = args[++i];
    } else if (args[i] === '--allow-destructive') {
      result.allowDestructive = true;
    }
  }
  return result;
}

/**
 * Run simplicity-schema migrations (plan + apply).
 * Delegates to the DatabaseProvider.migrate() method.
 */
export async function runMigrate(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  // 1. Load config
  let config: ProjectConfig;
  try {
    config = await loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      process.stderr.write(
        'No config file found. Run `npx simplicity-admin init` first or create simplicity-admin.config.ts\n',
      );
    } else {
      process.stderr.write(`Failed to load config: ${message}\n`);
    }
    process.exit(1);
  }

  // 2. Connect to database
  const provider = postgresProvider();
  let pool: ConnectionPool;
  try {
    pool = await provider.connect(config.database);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Cannot connect to database: ${message}. Is PostgreSQL running?\n`,
    );
    process.exit(1);
  }

  // 3. Run migrations
  const schemaDir = opts.schemaDir ?? resolve(process.cwd(), 'schema');
  const schema = opts.schema ?? config.schema ?? 'public';

  try {
    process.stdout.write(`Running migrations from ${schemaDir}...\n`);
    const result = await provider.migrate(pool, {
      schemaDir,
      schema,
      allowDestructive: opts.allowDestructive,
    });
    process.stdout.write(
      `Migration complete. Applied ${result.applied} operation(s): ${result.operations.join(', ') || 'none'}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Migration failed: ${message}\n`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}
