import { describe, it, expect } from 'vitest';

describe('@mabulu-inc/simplicity-admin-auth', () => {
  it('resolves import', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(mod).toBeDefined();
  });
});
