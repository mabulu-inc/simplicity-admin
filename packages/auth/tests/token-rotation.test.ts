import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '@mabulu-inc/simplicity-admin-core';
import { jwtTokenProvider } from '../src/providers/jwt.js';
import { createInMemoryRevocationStore } from '../src/revocation.js';
import { createRefreshHandler } from '../src/routes/refresh.js';
import { createServer, type Server } from 'node:http';

const SECRET = 'test-secret-for-token-rotation-testing';

const testPayload: TokenPayload = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  roles: ['app_editor'],
  activeRole: 'app_editor',
  authStrategy: 'password',
};

/** Helper: issue a refresh token for testing */
function issueRefreshToken(payload: TokenPayload, secret = SECRET): string {
  return jwt.sign(
    { ...payload, tokenType: 'refresh' },
    secret,
    { expiresIn: 3600 },
  );
}

/** Helper: HTTP request against test server */
async function request(
  server: Server,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

describe('token rotation (B-SEC-010)', () => {
  let tokenProvider: ReturnType<typeof jwtTokenProvider>;
  let revocationStore: ReturnType<typeof createInMemoryRevocationStore>;
  let server: Server;

  beforeEach(async () => {
    tokenProvider = jwtTokenProvider({ secret: SECRET });
    revocationStore = createInMemoryRevocationStore();
    const handler = createRefreshHandler(tokenProvider, undefined, revocationStore);
    server = createServer(async (req, res) => {
      await handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return () => {
      server.close();
    };
  });

  it('old refresh token is invalid after refresh (single-use)', async () => {
    const oldRefreshToken = issueRefreshToken(testPayload);

    // First refresh should succeed
    const first = await request(server, { refreshToken: oldRefreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeDefined();
    expect(first.body.refreshToken).toBeDefined();

    // Second refresh with same token should fail (token was revoked)
    const second = await request(server, { refreshToken: oldRefreshToken });
    expect(second.status).toBe(401);
  });

  it('reuse of revoked refresh token revokes all user tokens', async () => {
    const oldRefreshToken = issueRefreshToken(testPayload);

    // First refresh: old token becomes revoked, get new token
    const first = await request(server, { refreshToken: oldRefreshToken });
    expect(first.status).toBe(200);
    const newRefreshToken = first.body.refreshToken as string;

    // Simulate attacker reusing the old (revoked) token
    const reuse = await request(server, { refreshToken: oldRefreshToken });
    expect(reuse.status).toBe(401);

    // The legitimate user's new token should ALSO be revoked
    // (security response: all user tokens revoked on reuse detection)
    const legitimate = await request(server, { refreshToken: newRefreshToken });
    expect(legitimate.status).toBe(401);
  });

  it('returns new token pair on valid refresh', async () => {
    const refreshToken = issueRefreshToken(testPayload);

    const res = await request(server, { refreshToken });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    // The new refresh token should differ from the old one
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('refreshing with new token from rotation works', async () => {
    const oldRefreshToken = issueRefreshToken(testPayload);

    const first = await request(server, { refreshToken: oldRefreshToken });
    expect(first.status).toBe(200);
    const newToken = first.body.refreshToken as string;

    // Using the new token should work
    const second = await request(server, { refreshToken: newToken });
    expect(second.status).toBe(200);
    expect(second.body.accessToken).toBeDefined();
  });

  it('revocation store records old token after refresh', async () => {
    const refreshToken = issueRefreshToken(testPayload);

    await request(server, { refreshToken });

    // The old token should be marked as revoked
    const isRevoked = await revocationStore.isRevoked(refreshToken);
    expect(isRevoked).toBe(true);
  });

  it('user-level revocation blocks all tokens for that user', async () => {
    // Issue two separate refresh tokens for the same user
    const token1 = issueRefreshToken(testPayload);
    const token2 = issueRefreshToken(testPayload);

    // Revoke all tokens for user
    await revocationStore.revokeAllForUser(testPayload.userId);

    // Both tokens should be rejected
    const res1 = await request(server, { refreshToken: token1 });
    expect(res1.status).toBe(401);

    const res2 = await request(server, { refreshToken: token2 });
    expect(res2.status).toBe(401);
  });
});
