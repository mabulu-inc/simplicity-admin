import { describe, it, expect } from 'vitest';

describe('@mabulu-inc/simplicity-admin-auth exports', () => {
  it('exports password utilities', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.hashPassword).toBe('function');
    expect(typeof mod.verifyPassword).toBe('function');
  });

  it('exports JWT token provider', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.jwtTokenProvider).toBe('function');
  });

  it('exports AuthError', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(mod.AuthError).toBeDefined();
    const err = new mod.AuthError('test', 'AUTH_001');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('AUTH_001');
  });

  it('exports auth middleware', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.createAuthMiddleware).toBe('function');
  });

  it('exports getUserFromRequest', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.getUserFromRequest).toBe('function');
  });

  it('exports login handler', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.createLoginHandler).toBe('function');
  });

  it('exports logout handler', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.createLogoutHandler).toBe('function');
  });

  it('exports refresh handler', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.createRefreshHandler).toBe('function');
  });

  it('exports revocation store factories and hashToken', async () => {
    const mod = await import('@mabulu-inc/simplicity-admin-auth');
    expect(typeof mod.createInMemoryRevocationStore).toBe('function');
    expect(typeof mod.createDbRevocationStore).toBe('function');
    expect(typeof mod.hashToken).toBe('function');
  });
});
