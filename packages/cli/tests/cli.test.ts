import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const CLI_PATH = path.resolve(__dirname, '../src/cli.ts');

function runCLI(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI_PATH, ...args], {
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..'),
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

describe('CLI', () => {
  it('--help outputs usage information', () => {
    const { stdout, exitCode } = runCLI(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('simplicity-admin');
    expect(stdout).toContain('init');
    expect(stdout).toContain('dev');
    expect(stdout).toContain('build');
    expect(stdout).toContain('start');
    expect(stdout).toContain('generate');
    expect(stdout).toContain('migrate');
  });

  it('--version outputs version number', () => {
    const { stdout, exitCode } = runCLI(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('unknown command shows error and help suggestion', () => {
    const { stdout, exitCode } = runCLI(['foobar']);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Unknown command');
    expect(stdout).toContain('foobar');
    expect(stdout).toContain('--help');
  });
});
