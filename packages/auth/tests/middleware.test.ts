import { describe, it, expect, beforeAll } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { createAuthMiddleware, type AuthenticatedRequest, getUserFromRequest } from '@simplicity-admin/auth';
import { jwtTokenProvider } from '@simplicity-admin/auth';
import type { TokenProvider, TokenPayload, ConnectionPool } from '@simplicity-admin/core';

function createMockPool(): ConnectionPool {
  return {
    async query() { return { rows: [], rowCount: 0 }; },
    async withClient(fn: (client: object) => Promise<unknown>) { return fn({}); },
    async end() {},
  };
}

function createMockReq(headers: Record<string, string> = {}): IncomingMessage {
  const req = {
    headers: { ...headers },
  } as unknown as IncomingMessage;
  return req;
}

function createMockRes(): ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 200,
    body: '',
    setHeader(_name: string, _value: string) {},
    writeHead(code: number) { res.statusCode = code; return res; },
    end(body?: string) { res.body = body ?? ''; },
  } as unknown as ServerResponse & { statusCode: number; body: string };
  return res;
}

describe('Auth Middleware', () => {
  let tokenProvider: TokenProvider;
  let middleware: ReturnType<typeof createAuthMiddleware>;
  const pool = createMockPool();
  const testPayload: TokenPayload = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    roles: ['app_editor', 'app_viewer'],
    activeRole: 'app_editor',
    superAdmin: false,
    authStrategy: 'password',
  };

  beforeAll(() => {
    tokenProvider = jwtTokenProvider({ secret: 'test-secret-that-is-long-enough-32chars!!' });
    middleware = createAuthMiddleware(tokenProvider, pool, {} as never);
  });

  it('populates req.user for valid token (B-AUTH-010)', async () => {
    const token = await tokenProvider.sign(testPayload);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    let nextCalled = false;

    await middleware(req, res, () => { nextCalled = true; });

    const user = getUserFromRequest(req);
    expect(nextCalled).toBe(true);
    expect(user).toBeDefined();
    expect(user!.userId).toBe('user-123');
    expect(user!.tenantId).toBe('tenant-456');
    expect(user!.roles).toEqual(['app_editor', 'app_viewer']);
    expect(user!.activeRole).toBe('app_editor');
    expect(user!.superAdmin).toBe(false);
  });

  it('sets req.user undefined and calls next() for missing token (B-AUTH-011)', async () => {
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await middleware(req, res, () => { nextCalled = true; });

    const user = getUserFromRequest(req);
    expect(nextCalled).toBe(true);
    expect(user).toBeUndefined();
  });

  it('returns 401 for invalid token (B-AUTH-012)', async () => {
    const req = createMockReq({ authorization: 'Bearer invalid.token.here' });
    const res = createMockRes();
    let nextCalled = false;

    await middleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid token' });
  });

  it('returns 401 for expired token', async () => {
    // Create a provider with 0-second TTL
    const shortLivedProvider = jwtTokenProvider({
      secret: 'test-secret-that-is-long-enough-32chars!!',
      accessTokenTTL: 0,
    });
    const token = await shortLivedProvider.sign(testPayload);
    const shortMiddleware = createAuthMiddleware(shortLivedProvider, pool, {} as never);

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    let nextCalled = false;

    await shortMiddleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid token' });
  });

  it('handles Authorization header without Bearer prefix gracefully', async () => {
    const req = createMockReq({ authorization: 'Basic abc123' });
    const res = createMockRes();
    let nextCalled = false;

    await middleware(req, res, () => { nextCalled = true; });

    const user = getUserFromRequest(req);
    expect(nextCalled).toBe(true);
    expect(user).toBeUndefined();
  });
});

describe('getUserFromRequest', () => {
  it('returns undefined for plain request', () => {
    const req = createMockReq();
    expect(getUserFromRequest(req)).toBeUndefined();
  });
});
