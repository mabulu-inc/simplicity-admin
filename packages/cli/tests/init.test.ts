import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLI_PATH = path.resolve(__dirname, '../src/cli.ts');

function runCLI(args: string[], cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI_PATH, ...args], {
      encoding: 'utf-8',
      cwd: cwd ?? path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
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

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'simplicity-init-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates directory with expected files', () => {
    const projectDir = path.join(tmpDir, 'my-admin');
    const { exitCode } = runCLI(['init', projectDir]);
    expect(exitCode).toBe(0);

    // Check expected files exist
    expect(existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'simplicity-admin.config.ts'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'compose.yaml'))).toBe(true);
    expect(existsSync(path.join(projectDir, '.env.example'))).toBe(true);
    expect(existsSync(path.join(projectDir, '.gitignore'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'schema'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'views'))).toBe(true);
  });

  it('generated package.json has @simplicity-admin dependencies', () => {
    const projectDir = path.join(tmpDir, 'my-admin');
    runCLI(['init', projectDir]);

    const pkg = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@simplicity-admin/cli']).toBeDefined();
  });

  it('generated config has DATABASE_URL placeholder', () => {
    const projectDir = path.join(tmpDir, 'my-admin');
    runCLI(['init', projectDir]);

    const config = readFileSync(path.join(projectDir, 'simplicity-admin.config.ts'), 'utf-8');
    expect(config).toContain('DATABASE_URL');
  });

  it('rejects non-empty directory', () => {
    const projectDir = path.join(tmpDir, 'my-admin');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(path.join(projectDir, 'existing.txt'), 'hello');

    const { stdout, exitCode } = runCLI(['init', projectDir]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('already exists and is not empty');
  });

  it('works with "." (current directory) when empty', () => {
    const emptyDir = path.join(tmpDir, 'empty-proj');
    mkdirSync(emptyDir, { recursive: true });

    const { exitCode } = runCLI(['init', '.'], emptyDir);
    expect(exitCode).toBe(0);

    expect(existsSync(path.join(emptyDir, 'package.json'))).toBe(true);
    expect(existsSync(path.join(emptyDir, 'simplicity-admin.config.ts'))).toBe(true);
  });

  it('prints success message with next steps', () => {
    const projectDir = path.join(tmpDir, 'my-admin');
    const { stdout, exitCode } = runCLI(['init', projectDir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Created');
    expect(stdout).toContain('npx simplicity-admin dev');
  });
});
