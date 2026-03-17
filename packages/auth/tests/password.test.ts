import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@mabulu-inc/simplicity-admin-auth';

describe('password utilities', () => {
  it('hashPassword returns bcrypt hash starting with $2b$', async () => {
    const hash = await hashPassword('MyP@ssw0rd');
    expect(hash).toMatch(/^\$2b\$/);
    expect(hash).not.toBe('MyP@ssw0rd');
  });

  it('hashPassword uses cost factor 12 or higher', async () => {
    const hash = await hashPassword('TestPassword123');
    // bcrypt format: $2b$<cost>$<salt+hash>
    const costStr = hash.split('$')[2];
    const cost = parseInt(costStr, 10);
    expect(cost).toBeGreaterThanOrEqual(12);
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('MyP@ssw0rd');
    const result = await verifyPassword('MyP@ssw0rd', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('MyP@ssw0rd');
    const result = await verifyPassword('WrongPassword', hash);
    expect(result).toBe(false);
  });
});
