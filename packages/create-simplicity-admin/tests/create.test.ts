import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BIN_PATH = path.resolve(__dirname, '../src/index.ts');

function runCreate(args: string[], cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', BIN_PATH, ...args], {
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

describe('create-simplicity-admin', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'create-simplicity-admin-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scaffolds a project when given a directory name', () => {
    const projectDir = path.join(tmpDir, 'my-app');
    const { exitCode } = runCreate([projectDir]);
    expect(exitCode).toBe(0);

    expect(existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'simplicity-admin.config.ts'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'compose.yaml'))).toBe(true);
    expect(existsSync(path.join(projectDir, '.env.example'))).toBe(true);
    expect(existsSync(path.join(projectDir, '.gitignore'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'schema'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'views'))).toBe(true);
  });

  it('prints success message with next steps', () => {
    const projectDir = path.join(tmpDir, 'my-app');
    const { stdout, exitCode } = runCreate([projectDir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Created');
  });

  it('works with "." for the current directory', () => {
    const emptyDir = path.join(tmpDir, 'empty-proj');
    mkdirSync(emptyDir, { recursive: true });

    const { exitCode } = runCreate(['.'], emptyDir);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(emptyDir, 'package.json'))).toBe(true);
  });

  it('rejects non-empty directories', () => {
    const projectDir = path.join(tmpDir, 'my-app');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(path.join(projectDir, 'existing.txt'), 'hello');

    const { exitCode, stdout } = runCreate([projectDir]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('already exists and is not empty');
  });

  it('shows usage when no arguments provided', () => {
    const { stdout, exitCode } = runCreate([]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Usage');
  });

  it('shows version with --version flag', () => {
    const { stdout, exitCode } = runCreate(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('shows help with --help flag', () => {
    const { stdout, exitCode } = runCreate(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage');
    expect(stdout).toContain('create-simplicity-admin');
  });

  it('generated package.json has CLI dependency', () => {
    const projectDir = path.join(tmpDir, 'my-app');
    runCreate([projectDir]);

    const pkg = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@mabulu-inc/simplicity-admin-cli']).toBeDefined();
  });

  it('generated config has DATABASE_URL placeholder', () => {
    const projectDir = path.join(tmpDir, 'my-app');
    runCreate([projectDir]);

    const config = readFileSync(path.join(projectDir, 'simplicity-admin.config.ts'), 'utf-8');
    expect(config).toContain('DATABASE_URL');
  });

  it('uses directory name as project name in templates', () => {
    const projectDir = path.join(tmpDir, 'my-cool-app');
    runCreate([projectDir]);

    const pkg = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('my-cool-app');

    const compose = readFileSync(path.join(projectDir, 'compose.yaml'), 'utf-8');
    expect(compose).toContain('POSTGRES_DB: my-cool-app');
  });
});
