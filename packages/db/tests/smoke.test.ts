import { describe, it, expect } from 'vitest';

describe('@simplicity-admin/db', () => {
  it('can be imported', async () => {
    const mod = await import('@simplicity-admin/db');
    expect(mod).toBeDefined();
  });
});
