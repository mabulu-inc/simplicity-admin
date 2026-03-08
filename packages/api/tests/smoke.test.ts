import { describe, it, expect } from 'vitest';

describe('@simplicity-admin/api', () => {
  it('can be imported', async () => {
    const mod = await import('@simplicity-admin/api');
    expect(mod).toBeDefined();
  });
});
