import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRateLimiter, type RateLimiter } from '../src/rate-limit.js';
import { createLoginHandler } from '../src/routes/login.js';
import { createRefreshHandler } from '../src/routes/refresh.js';
import type { TokenProvider, ConnectionPool } from '@simplicity-admin/core';
import { defineConfig } from '@simplicity-admin/core';
import { bootstrap } from '../../db/src/bootstrap.js';
import { jwtTokenProvider } from '../src/providers/jwt.js';
import { hashPassword } from '../src/strategies/password.js';
import { createTestDb, destroyTestDb, type TestDb } from '@simplicity-admin/test-support';

describe('rate-limit', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    expect(limiter.check('192.168.1.1').allowed).toBe(true);
    expect(limiter.check('192.168.1.1').allowed).toBe(true);
    expect(limiter.check('192.168.1.1').allowed).toBe(true);
  });

  it('returns 429 after exceeding limit', () => {
    limiter.check('10.0.0.1');
    limiter.check('10.0.0.1');
    limiter.check('10.0.0.1');
    const result = limiter.check('10.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets after window expires', () => {
    limiter.check('10.0.0.2');
    limiter.check('10.0.0.2');
    limiter.check('10.0.0.2');
    expect(limiter.check('10.0.0.2').allowed).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(60_001);

    expect(limiter.check('10.0.0.2').allowed).toBe(true);
  });

  it('returns Retry-After header value in seconds', () => {
    limiter.check('10.0.0.3');
    limiter.check('10.0.0.3');
    limiter.check('10.0.0.3');

    // Advance 10 seconds into the window
    vi.advanceTimersByTime(10_000);

    const result = limiter.check('10.0.0.3');
    expect(result.allowed).toBe(false);
    // retryAfter should be ~50 seconds (window is 60s, 10s elapsed)
    expect(result.retryAfter).toBeGreaterThanOrEqual(49);
    expect(result.retryAfter).toBeLessThanOrEqual(51);
  });

  it('tracks different IPs independently', () => {
    limiter.check('10.0.0.4');
    limiter.check('10.0.0.4');
    limiter.check('10.0.0.4');
    expect(limiter.check('10.0.0.4').allowed).toBe(false);

    // Different IP should still be allowed
    expect(limiter.check('10.0.0.5').allowed).toBe(true);
  });

  it('uses default limits when no options provided', () => {
    const defaultLimiter = createRateLimiter();
    // Default is 10 attempts per 15-minute window
    for (let i = 0; i < 10; i++) {
      expect(defaultLimiter.check('10.0.0.6').allowed).toBe(true);
    }
    expect(defaultLimiter.check('10.0.0.6').allowed).toBe(false);
  });

  it('can be disabled for test environments', () => {
    const disabled = createRateLimiter({ disabled: true });
    for (let i = 0; i < 100; i++) {
      expect(disabled.check('10.0.0.7').allowed).toBe(true);
    }
  });
});

/** Helper to make HTTP requests to a test server */
async function httpRequest(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

describe('rate limiting on auth routes (integration)', () => {
  const TEST_SCHEMA = 'public';
  let testDb: TestDb;
  let tokenProvider: TokenProvider;
  let server: Server;

  beforeAll(async () => {
    testDb = await createTestDb();

    const config = defineConfig({
      database: testDb.url,
      schema: TEST_SCHEMA,
      systemSchema: TEST_SCHEMA,
    });

    await bootstrap(testDb.pool, config);

    tokenProvider = jwtTokenProvider(config.auth);

    // Create test user
    const hash = await hashPassword('password123');
    await testDb.pool.query(
      `INSERT INTO ${TEST_SCHEMA}.users (email, password_hash, super_admin)
       VALUES ('rate-test@example.com', $1, false)
       ON CONFLICT (email) DO NOTHING`,
      [hash],
    );

    const userResult = await testDb.pool.query<{ id: string }>(
      `SELECT id FROM ${TEST_SCHEMA}.users WHERE email = 'rate-test@example.com'`,
    );
    const tenantResult = await testDb.pool.query<{ id: string }>(
      `SELECT id FROM ${TEST_SCHEMA}.tenants WHERE slug = 'default'`,
    );

    await testDb.pool.query(
      `INSERT INTO ${TEST_SCHEMA}.memberships (user_id, tenant_id, role)
       VALUES ($1, $2, 'app_viewer')
       ON CONFLICT DO NOTHING`,
      [userResult.rows[0].id, tenantResult.rows[0].id],
    );

    // Create handlers with strict rate limits for testing
    const loginLimiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 });
    const refreshLimiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 });

    const loginHandler = createLoginHandler(tokenProvider, testDb.pool, TEST_SCHEMA, loginLimiter);
    const refreshHandler = createRefreshHandler(tokenProvider, refreshLimiter);

    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '';
      if (url === '/auth/login' && req.method === 'POST') {
        await loginHandler(req, res);
      } else if (url === '/auth/refresh' && req.method === 'POST') {
        await refreshHandler(req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    server.close();
    await destroyTestDb(testDb);
  });

  it('login returns 429 with Retry-After after exceeding limit', async () => {
    const loginBody = {
      strategy: 'password',
      email: 'rate-test@example.com',
      password: 'password123',
    };

    // First 2 requests should succeed
    const res1 = await httpRequest(server, 'POST', '/auth/login', loginBody);
    expect(res1.status).toBe(200);

    const res2 = await httpRequest(server, 'POST', '/auth/login', loginBody);
    expect(res2.status).toBe(200);

    // Third request should be rate limited
    const res3 = await httpRequest(server, 'POST', '/auth/login', loginBody);
    expect(res3.status).toBe(429);
    expect((res3.body as { error: string }).error).toBe('Too many requests');
    expect(res3.headers.get('retry-after')).toBeDefined();
    expect(Number(res3.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('refresh returns 429 with Retry-After after exceeding limit', async () => {
    // Get a valid refresh token first (using the login endpoint which is already rate-limited,
    // so we use a direct token sign instead)
    const payload = {
      userId: 'test-id',
      tenantId: 'test-tenant',
      roles: ['app_viewer'],
      activeRole: 'app_viewer',
      superAdmin: false,
      authStrategy: 'password',
    };
    const tempToken = await tokenProvider.sign(payload);
    const pair = await tokenProvider.refresh(tempToken);

    // First 2 refresh requests should succeed
    const res1 = await httpRequest(server, 'POST', '/auth/refresh', {
      refreshToken: pair.refreshToken,
    });
    expect(res1.status).toBe(200);

    // Get new refresh token from previous response
    const newPair1 = res1.body as { refreshToken: string };
    const res2 = await httpRequest(server, 'POST', '/auth/refresh', {
      refreshToken: newPair1.refreshToken,
    });
    expect(res2.status).toBe(200);

    // Third request should be rate limited
    const newPair2 = res2.body as { refreshToken: string };
    const res3 = await httpRequest(server, 'POST', '/auth/refresh', {
      refreshToken: newPair2.refreshToken,
    });
    expect(res3.status).toBe(429);
    expect((res3.body as { error: string }).error).toBe('Too many requests');
    expect(res3.headers.get('retry-after')).toBeDefined();
  });
});
