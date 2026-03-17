import { describe, it, expect } from 'vitest';

describe('@mabulu-inc/simplicity-admin-db', () => {
  it('can be imported', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-db');
    expect(mod).toBeDefined();
  });
});
