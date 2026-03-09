import { resolve } from 'node:path';
import { loadConfig } from '@simplicity-admin/core';
import { postgresProvider } from '@simplicity-admin/db';
import type { ProjectConfig, ConnectionPool } from '@simplicity-admin/core';

/**
 * Parse CLI args for the generate command.
 * Supports: --output-dir <dir>, --schema <name>
 */
function parseArgs(args: string[]): { outputDir?: string; schema?: string } {
  const result: { outputDir?: string; schema?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      result.outputDir = args[++i];
    } else if (args[i] === '--schema' && args[i + 1]) {
      result.schema = args[++i];
    }
  }
  return result;
}

/**
 * Generate schema-flow YAML from existing database.
 * Delegates to the DatabaseProvider.generate() method.
 */
export async function runGenerate(args: string[]): Promise<void> {
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

  // 3. Generate schema YAML
  const outputDir = opts.outputDir ?? resolve(process.cwd(), 'schema');
  const schema = opts.schema ?? config.schema ?? 'public';

  try {
    process.stdout.write(`Generating schema from "${schema}" to ${outputDir}...\n`);
    await provider.generate(pool, outputDir, schema);
    process.stdout.write('Schema generation complete.\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Schema generation failed: ${message}\n`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}
