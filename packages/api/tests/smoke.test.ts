import { describe, it, expect } from 'vitest';

describe('@mabulu-inc/simplicity-admin-api', () => {
  it('can be imported', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-api');
    expect(mod).toBeDefined();
  });
});
