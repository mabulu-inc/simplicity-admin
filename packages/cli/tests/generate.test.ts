import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const CLI_PATH = path.resolve(__dirname, '../src/cli.ts');
const DB_URL = process.env['DATABASE_URL'] ?? 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

function runCLI(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; timeout?: number } = {},
): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI_PATH, ...args], {
      encoding: 'utf-8',
      cwd: opts.cwd ?? path.resolve(__dirname, '..'),
      env: { ...process.env, ...opts.env, NODE_ENV: 'test' },
      timeout: opts.timeout ?? 15_000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (error.stdout ?? '') + (error.stderr ?? ''),
      exitCode: error.status ?? 1,
    };
  }
}

describe('CLI generate command', () => {
  it('fails gracefully if no config file exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-gen-'));
    try {
      const { stdout, exitCode } = runCLI(['generate'], { cwd: tmpDir });
      expect(exitCode).not.toBe(0);
      expect(stdout).toContain('No config file found');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails gracefully if DB is not reachable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-gen-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: 'postgresql://localhost:59999/nonexistent_db' };`,
      );
      const { stdout, exitCode } = runCLI(['generate'], {
        cwd: tmpDir,
        timeout: 30_000,
      });
      expect(exitCode).not.toBe(0);
      expect(stdout).toContain('Cannot connect to database');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates YAML files from test database', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-gen-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: '${DB_URL}' };`,
      );
      fs.mkdirSync(path.join(tmpDir, 'schema'), { recursive: true });

      const { stdout, exitCode } = runCLI(['generate'], {
        cwd: tmpDir,
        timeout: 30_000,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Schema generation complete');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('accepts --output-dir flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-gen-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: '${DB_URL}' };`,
      );
      const outDir = path.join(tmpDir, 'custom-schema');
      fs.mkdirSync(outDir, { recursive: true });

      const { stdout, exitCode } = runCLI(
        ['generate', '--output-dir', outDir],
        { cwd: tmpDir, timeout: 30_000 },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Schema generation complete');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('CLI migrate command', () => {
  it('fails gracefully if no config file exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-mig-'));
    try {
      const { stdout, exitCode } = runCLI(['migrate'], { cwd: tmpDir });
      expect(exitCode).not.toBe(0);
      expect(stdout).toContain('No config file found');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails gracefully if DB is not reachable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-mig-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: 'postgresql://localhost:59999/nonexistent_db' };`,
      );
      const { stdout, exitCode } = runCLI(['migrate'], {
        cwd: tmpDir,
        timeout: 30_000,
      });
      expect(exitCode).not.toBe(0);
      expect(stdout).toContain('Cannot connect to database');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('applies schema changes from schema directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-mig-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: '${DB_URL}' };`,
      );
      fs.mkdirSync(path.join(tmpDir, 'schema'), { recursive: true });

      const { stdout, exitCode } = runCLI(['migrate'], {
        cwd: tmpDir,
        timeout: 30_000,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Migration complete');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('accepts --schema-dir flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-mig-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: '${DB_URL}' };`,
      );
      const schemaDir = path.join(tmpDir, 'custom-schema');
      fs.mkdirSync(schemaDir, { recursive: true });

      const { stdout, exitCode } = runCLI(
        ['migrate', '--schema-dir', schemaDir],
        { cwd: tmpDir, timeout: 30_000 },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Migration complete');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('accepts --allow-destructive flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-mig-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'simplicity-admin.config.ts'),
        `export default { database: '${DB_URL}' };`,
      );
      fs.mkdirSync(path.join(tmpDir, 'schema'), { recursive: true });

      const { stdout, exitCode } = runCLI(
        ['migrate', '--allow-destructive'],
        { cwd: tmpDir, timeout: 30_000 },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Migration complete');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
