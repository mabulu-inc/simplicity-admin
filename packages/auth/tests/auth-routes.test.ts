import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IncomingMessage, ServerResponse, createServer, Server } from 'node:http';
import type { ConnectionPool, TokenProvider } from '@simplicity-admin/core';
import { defineConfig } from '@simplicity-admin/core';
import { createPool } from '../../db/src/connection.js';
import { bootstrap } from '../../db/src/bootstrap.js';
import { jwtTokenProvider } from '../src/providers/jwt.js';
import { hashPassword } from '../src/strategies/password.js';
import { createLoginHandler } from '../src/routes/login.js';
import { createLogoutHandler } from '../src/routes/logout.js';
import { createRefreshHandler } from '../src/routes/refresh.js';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';
const TEST_SCHEMA = 'auth_routes_test';

/** Helper: role priority for determining highest-privilege role */
const ROLE_PRIORITY: Record<string, number> = {
  app_admin: 3,
  app_editor: 2,
  app_viewer: 1,
};

/** Helper to make HTTP requests to the test server */
async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

describe('auth routes (integration)', () => {
  let pool: ConnectionPool;
  let tokenProvider: TokenProvider;
  let server: Server;

  const config = defineConfig({
    database: TEST_URL,
    schema: TEST_SCHEMA,
    systemSchema: TEST_SCHEMA,
  });

  beforeAll(async () => {
    pool = createPool(TEST_URL);

    // Clean slate
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await bootstrap(pool, config);

    tokenProvider = jwtTokenProvider(config.auth);

    // Create test user with known credentials
    const hash = await hashPassword('password123');
    await pool.query(
      `INSERT INTO ${TEST_SCHEMA}.users (email, password_hash, super_admin)
       VALUES ('alice@example.com', $1, false)
       ON CONFLICT (email) DO NOTHING`,
      [hash],
    );

    // Get alice's user id and default tenant id
    const aliceResult = await pool.query<{ id: string }>(
      `SELECT id FROM ${TEST_SCHEMA}.users WHERE email = 'alice@example.com'`,
    );
    const tenantResult = await pool.query<{ id: string }>(
      `SELECT id FROM ${TEST_SCHEMA}.tenants WHERE slug = 'default'`,
    );

    const aliceId = aliceResult.rows[0].id;
    const tenantId = tenantResult.rows[0].id;

    // Create memberships for alice (app_editor + app_viewer)
    await pool.query(
      `INSERT INTO ${TEST_SCHEMA}.memberships (user_id, tenant_id, role)
       VALUES ($1, $2, 'app_editor'), ($1, $2, 'app_viewer')
       ON CONFLICT DO NOTHING`,
      [aliceId, tenantId],
    );

    // Set up the HTTP server with routing
    const loginHandler = createLoginHandler(tokenProvider, pool, TEST_SCHEMA);
    const logoutHandler = createLogoutHandler(tokenProvider, pool, TEST_SCHEMA);
    const refreshHandler = createRefreshHandler(tokenProvider);

    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '';
      if (url === '/auth/login' && req.method === 'POST') {
        await loginHandler(req, res);
      } else if (url === '/auth/logout' && req.method === 'POST') {
        await logoutHandler(req, res);
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
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await pool.end();
  });

  // ── Login ─────────────────────────────────────────────────

  it('valid login returns token pair (200)', async () => {
    const res = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    const body = res.body as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('invalid email returns 401 (same message as wrong password)', async () => {
    const res = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'unknown@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('Invalid credentials');
  });

  it('invalid password returns 401', async () => {
    const res = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('Invalid credentials');
  });

  it('JWT payload includes userId, role, tenantId', async () => {
    const res = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    const body = res.body as { accessToken: string };
    const payload = await tokenProvider.verify(body.accessToken);

    expect(payload.userId).toBeDefined();
    expect(payload.tenantId).toBeDefined();
    expect(payload.roles).toEqual(expect.arrayContaining(['app_editor', 'app_viewer']));
    // Highest-privilege role should be default active role
    expect(payload.activeRole).toBe('app_editor');
    expect(payload.authStrategy).toBe('password');
  });

  // ── Refresh ───────────────────────────────────────────────

  it('refresh with valid token returns new pair', async () => {
    const loginRes = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'password123',
    });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    const refreshRes = await request(server, 'POST', '/auth/refresh', {
      refreshToken,
    });
    expect(refreshRes.status).toBe(200);
    const body = refreshRes.body as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    // Verify the new access token is valid and contains correct payload
    const payload = await tokenProvider.verify(body.accessToken);
    expect(payload.userId).toBeDefined();
  });

  // ── Logout ────────────────────────────────────────────────

  it('logout invalidates refresh token', async () => {
    // Login first to get tokens
    const loginRes = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'password123',
    });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    // Logout with the refresh token
    const logoutRes = await request(server, 'POST', '/auth/logout', {
      refreshToken,
    });
    expect(logoutRes.status).toBe(200);

    // Attempt to refresh with invalidated token should fail
    const refreshRes = await request(server, 'POST', '/auth/refresh', {
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
  });

  it('refresh with invalidated token returns 401', async () => {
    // Login
    const loginRes = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'alice@example.com',
      password: 'password123',
    });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    // Logout (invalidate)
    await request(server, 'POST', '/auth/logout', { refreshToken });

    // Try to refresh
    const refreshRes = await request(server, 'POST', '/auth/refresh', {
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
    expect((refreshRes.body as { error: string }).error).toBe('Token has been revoked');
  });

  // ── Default admin ─────────────────────────────────────────

  it('default admin can log in after bootstrap', async () => {
    const res = await request(server, 'POST', '/auth/login', {
      strategy: 'password',
      email: 'admin@localhost',
      password: 'changeme',
    });

    expect(res.status).toBe(200);
    const body = res.body as { accessToken: string };
    const payload = await tokenProvider.verify(body.accessToken);

    expect(payload.superAdmin).toBe(true);
    expect(payload.roles).toContain('app_admin');
    expect(payload.activeRole).toBe('app_admin');
    expect(payload.tenantId).toBeDefined();
  });
});
