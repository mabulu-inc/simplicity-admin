import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { loadConfig, resolveConfig } from '@mabulu-inc/simplicity-admin-core';
import { ConfigError } from '@mabulu-inc/simplicity-admin-core';

describe('resolveConfig', () => {
  it('returns a valid ProjectConfig with defaults applied', () => {
    const config = resolveConfig({ database: 'postgres://localhost/mydb' }, {});
    expect(config.database).toBe('postgres://localhost/mydb');
    expect(config.port).toBe(3000);
    expect(config.schema).toBe('public');
    expect(config.basePath).toBe('/admin');
  });

  it('preserves file config values over defaults', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb', port: 5000 },
      {},
    );
    expect(config.port).toBe(5000);
  });

  it('env overrides file config for port', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb', port: 3000 },
      { SIMPLICITY_ADMIN_PORT: '4000' },
    );
    expect(config.port).toBe(4000);
  });

  it('env overrides database', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb' },
      { SIMPLICITY_ADMIN_DATABASE: 'postgres://other/db' },
    );
    expect(config.database).toBe('postgres://other/db');
  });

  it('env overrides schema', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb' },
      { SIMPLICITY_ADMIN_SCHEMA: 'crm' },
    );
    expect(config.schema).toBe('crm');
  });

  it('env overrides basePath', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb' },
      { SIMPLICITY_ADMIN_BASE_PATH: '/dashboard' },
    );
    expect(config.basePath).toBe('/dashboard');
  });

  it('env overrides auth secret', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb' },
      { SIMPLICITY_ADMIN_AUTH_SECRET: 'my-secret-that-is-at-least-32-chars!' },
    );
    expect(config.auth?.secret).toBe('my-secret-that-is-at-least-32-chars!');
  });

  it('resolution order is defaults < file < env', () => {
    // default port is 3000, file sets 5000, env sets 4000 → env wins
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb', port: 5000 },
      { SIMPLICITY_ADMIN_PORT: '4000' },
    );
    expect(config.port).toBe(4000);
  });

  it('ignores unknown env vars', () => {
    const config = resolveConfig(
      { database: 'postgres://localhost/mydb' },
      { SIMPLICITY_ADMIN_UNKNOWN_FIELD: 'value' },
    );
    expect(config.port).toBe(3000); // default, not affected
  });

  it('throws ConfigError for missing database in file config with no env override', () => {
    expect(() => resolveConfig({}, {})).toThrow(ConfigError);
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sa-config-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads config from a TypeScript file', async () => {
    const configPath = join(tmpDir, 'simplicity-admin.config.ts');
    await writeFile(
      configPath,
      `export default { database: 'postgres://localhost/testdb' };\n`,
    );
    const config = await loadConfig(configPath);
    expect(config.database).toBe('postgres://localhost/testdb');
    expect(config.port).toBe(3000); // default applied
  });

  it('merges env vars with file config', async () => {
    const configPath = join(tmpDir, 'simplicity-admin.config.ts');
    await writeFile(
      configPath,
      `export default { database: 'postgres://localhost/testdb', port: 3000 };\n`,
    );

    const originalEnv = process.env.SIMPLICITY_ADMIN_PORT;
    process.env.SIMPLICITY_ADMIN_PORT = '4000';
    try {
      const config = await loadConfig(configPath);
      expect(config.port).toBe(4000);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.SIMPLICITY_ADMIN_PORT;
      } else {
        process.env.SIMPLICITY_ADMIN_PORT = originalEnv;
      }
    }
  });

  it('throws ConfigError for missing file with helpful message', async () => {
    const missingPath = join(tmpDir, 'nonexistent.config.ts');
    await expect(loadConfig(missingPath)).rejects.toThrow(ConfigError);
    await expect(loadConfig(missingPath)).rejects.toThrow(/not found/i);
  });

  it('throws ConfigError with CORE_003 code for missing file', async () => {
    const missingPath = join(tmpDir, 'nonexistent.config.ts');
    try {
      await loadConfig(missingPath);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).code).toBe('CORE_003');
    }
  });

  it('searches default paths when no argument is given', async () => {
    // This test verifies loadConfig() without args looks for default config file names
    // We expect it to throw CORE_003 when run from a directory with no config file
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await expect(loadConfig()).rejects.toThrow(ConfigError);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
