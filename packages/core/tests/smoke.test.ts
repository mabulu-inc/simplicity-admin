import { describe, it, expect } from 'vitest';

describe('@simplicity-admin/core', () => {
  it('should resolve the core package import', async () => {
    const core = await import('../src/index.js');
    expect(core).toBeDefined();
  });
});
