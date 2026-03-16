import { describe, it, expect } from 'vitest';
import { startPostgres, stopPostgres } from './global-setup.js';

describe('global-setup Docker lifecycle', () => {
  it('exports startPostgres function', () => {
    expect(typeof startPostgres).toBe('function');
  });

  it('exports stopPostgres function', () => {
    expect(typeof stopPostgres).toBe('function');
  });

  it('startPostgres is idempotent — calling when already running succeeds', async () => {
    // Container should already be running (started by globalSetup)
    // Calling again should not throw
    await expect(startPostgres()).resolves.not.toThrow();
  });
});
