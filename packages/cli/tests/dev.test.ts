import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';

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

describe('CLI dev command', () => {
  describe('config not found', () => {
    it('fails gracefully if no config file exists', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-dev-'));
      try {
        const { stdout, exitCode } = runCLI(['dev'], { cwd: tmpDir });
        expect(exitCode).not.toBe(0);
        expect(stdout).toContain('No config file found');
        expect(stdout).toContain('simplicity-admin init');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('database not available', () => {
    it('fails gracefully if DB is not reachable', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-dev-'));
      try {
        const configContent = `
          export default {
            database: 'postgresql://localhost:59999/nonexistent_db',
            port: 0,
          };
        `;
        fs.writeFileSync(
          path.join(tmpDir, 'simplicity-admin.config.ts'),
          configContent,
        );
        const { stdout, exitCode } = runCLI(['dev'], {
          cwd: tmpDir,
          timeout: 30_000,
        });
        expect(exitCode).not.toBe(0);
        expect(stdout).toContain('Cannot connect to database');
        expect(stdout).toContain('Is PostgreSQL running?');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('startup banner', () => {
    it('prints startup banner with URLs when started successfully', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-dev-'));
      try {
        const configContent = `
          export default {
            database: '${DB_URL}',
            port: 0,
            auth: {
              secret: 'test-secret-for-dev-command-test',
            },
          };
        `;
        fs.writeFileSync(
          path.join(tmpDir, 'simplicity-admin.config.ts'),
          configContent,
        );

        const { spawn } = await import('node:child_process');
        const child = spawn('npx', ['tsx', CLI_PATH, 'dev'], {
          cwd: tmpDir,
          env: { ...process.env, NODE_ENV: 'test' },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const bannerPromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timed out waiting for banner. stdout: ${stdout}, stderr: ${stderr}`));
          }, 30_000);

          const check = () => {
            if (stdout.includes('SIMPLICITY-ADMIN dev server running')) {
              clearTimeout(timeout);
              resolve(stdout);
            }
          };

          child.stdout.on('data', check);
          child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
          child.on('exit', (code) => {
            clearTimeout(timeout);
            if (!stdout.includes('SIMPLICITY-ADMIN dev server running')) {
              reject(new Error(`Process exited with code ${code}. stdout: ${stdout}, stderr: ${stderr}`));
            }
          });
        });

        const banner = await bannerPromise;

        expect(banner).toContain('SIMPLICITY-ADMIN dev server running');
        expect(banner).toContain('Admin UI:');
        expect(banner).toContain('GraphQL:');
        expect(banner).toContain('/admin');
        expect(banner).toContain('/api/graphql');

        const portMatch = banner.match(/localhost:(\d+)/);
        expect(portMatch).not.toBeNull();
        const port = Number(portMatch![1]);

        const healthRes = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/api/graphql`, (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            res.on('end', () => { resolve({ statusCode: res.statusCode ?? 0, body }); });
          });
          req.on('error', reject);
          req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Health check timed out'));
          });
        });

        expect([200, 302, 405]).toContain(healthRes.statusCode);

        child.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          child.on('exit', () => resolve());
          setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 5000);
        });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 60_000);
  });

  describe('bootstraps DB on first run', () => {
    it('bootstraps the database during startup', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-dev-'));
      try {
        const configContent = `
          export default {
            database: '${DB_URL}',
            port: 0,
            auth: {
              secret: 'test-secret-for-bootstrap-test',
            },
          };
        `;
        fs.writeFileSync(
          path.join(tmpDir, 'simplicity-admin.config.ts'),
          configContent,
        );

        const { spawn } = await import('node:child_process');
        const child = spawn('npx', ['tsx', CLI_PATH, 'dev'], {
          cwd: tmpDir,
          env: { ...process.env, NODE_ENV: 'test' },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timed out. stdout: ${stdout}, stderr: ${stderr}`));
          }, 30_000);

          const check = () => {
            if (stdout.includes('SIMPLICITY-ADMIN dev server running')) {
              clearTimeout(timeout);
              resolve();
            }
          };

          child.stdout.on('data', check);
          child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
          child.on('exit', (code) => {
            clearTimeout(timeout);
            if (!stdout.includes('SIMPLICITY-ADMIN dev server running')) {
              reject(new Error(`Exited ${code}. stdout: ${stdout}, stderr: ${stderr}`));
            }
          });
        });

        expect(stdout).toContain('Bootstrapping database');

        child.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          child.on('exit', () => resolve());
          setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 5000);
        });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 60_000);
  });
});
