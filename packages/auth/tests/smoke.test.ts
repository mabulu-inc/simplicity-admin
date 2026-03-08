import { describe, it, expect } from 'vitest';

describe('@simplicity-admin/auth', () => {
  it('resolves import', async () => {
    const mod = await import('@simplicity-admin/auth');
    expect(mod).toBeDefined();
  });
});
