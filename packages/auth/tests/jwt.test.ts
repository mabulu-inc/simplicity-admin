import { describe, it, expect } from 'vitest';
import { jwtTokenProvider, AuthError } from '@simplicity-admin/auth';
import type { TokenPayload } from '@simplicity-admin/core';

const SECRET = 'test-secret-key-that-is-long-enough';

describe('JWT token provider', () => {
  const provider = jwtTokenProvider({ secret: SECRET, accessTokenTTL: 10, refreshTokenTTL: 60 });

  it('sign() produces a valid JWT string', async () => {
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_editor', 'app_viewer'],
      activeRole: 'app_editor',
      authStrategy: 'password',
    };
    const token = await provider.sign(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verify() returns correct payload', async () => {
    const payload: TokenPayload = {
      userId: 'abc',
      tenantId: 'tenant-1',
      roles: ['app_editor'],
      activeRole: 'app_editor',
      superAdmin: false,
      authStrategy: 'password',
    };
    const token = await provider.sign(payload);
    const decoded = await provider.verify(token);
    expect(decoded.userId).toBe('abc');
    expect(decoded.tenantId).toBe('tenant-1');
    expect(decoded.roles).toEqual(['app_editor']);
    expect(decoded.activeRole).toBe('app_editor');
    expect(decoded.superAdmin).toBe(false);
    expect(decoded.authStrategy).toBe('password');
  });

  it('verify() throws AuthError for expired token', async () => {
    const shortLivedProvider = jwtTokenProvider({ secret: SECRET, accessTokenTTL: -1 });
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_viewer'],
      activeRole: 'app_viewer',
      authStrategy: 'password',
    };
    const token = await shortLivedProvider.sign(payload);
    await expect(shortLivedProvider.verify(token)).rejects.toThrow(AuthError);
    await expect(shortLivedProvider.verify(token)).rejects.toMatchObject({ code: 'AUTH_002' });
  });

  it('verify() throws AuthError for invalid signature', async () => {
    const otherProvider = jwtTokenProvider({ secret: 'different-secret-key-entirely' });
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_viewer'],
      activeRole: 'app_viewer',
      authStrategy: 'password',
    };
    const token = await provider.sign(payload);
    await expect(otherProvider.verify(token)).rejects.toThrow(AuthError);
    await expect(otherProvider.verify(token)).rejects.toMatchObject({ code: 'AUTH_003' });
  });

  it('refresh() returns new token pair', async () => {
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_editor'],
      activeRole: 'app_editor',
      authStrategy: 'password',
    };
    const accessToken = await provider.sign(payload);
    // First get a token pair by refreshing the access token
    const pair = await provider.refresh(accessToken);
    expect(pair.accessToken).toBeDefined();
    expect(pair.refreshToken).toBeDefined();
    // Access and refresh tokens must differ (different tokenType claims)
    expect(pair.accessToken).not.toBe(pair.refreshToken);
    expect(pair.accessToken.split('.')).toHaveLength(3);
    expect(pair.refreshToken.split('.')).toHaveLength(3);
    // The new access token should be verifiable
    const decoded = await provider.verify(pair.accessToken);
    expect(decoded.userId).toBe('abc');
    expect(decoded.roles).toEqual(['app_editor']);
  });

  it('refresh() throws AuthError for expired refresh token', async () => {
    // Both TTLs are negative so any token created is immediately expired
    const shortRefreshProvider = jwtTokenProvider({ secret: SECRET, accessTokenTTL: -1, refreshTokenTTL: -1 });
    const payload: TokenPayload = {
      userId: 'abc',
      roles: ['app_viewer'],
      activeRole: 'app_viewer',
      authStrategy: 'password',
    };
    const token = await shortRefreshProvider.sign(payload);
    await expect(shortRefreshProvider.refresh(token)).rejects.toThrow(AuthError);
    await expect(shortRefreshProvider.refresh(token)).rejects.toMatchObject({ code: 'AUTH_004' });
  });
});
