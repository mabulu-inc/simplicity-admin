import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, ConnectionPool, HttpHandler } from '@simplicity-admin/core';
import { verifyPassword } from '../strategies/password.js';
import { parseBody, json } from './helpers.js';

/** Role priority — higher number = higher privilege */
const ROLE_PRIORITY: Record<string, number> = {
  app_admin: 3,
  app_editor: 2,
  app_viewer: 1,
};

/**
 * Creates a login route handler.
 * POST /auth/login
 * Body: { strategy: "password", email: string, password: string }
 * Returns: { accessToken, refreshToken }
 */
export function createLoginHandler(
  tokenProvider: TokenProvider,
  pool: ConnectionPool,
  schema: string,
): HttpHandler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let body: Record<string, unknown>;
    try {
      body = await parseBody(req);
    } catch {
      json(res, 400, { error: 'Invalid request body' });
      return;
    }

    const { strategy, email, password } = body as {
      strategy?: string;
      email?: string;
      password?: string;
    };

    if (strategy !== 'password') {
      json(res, 400, { error: `Strategy '${strategy ?? 'undefined'}' is not available` });
      return;
    }

    if (!email || !password) {
      json(res, 400, { error: 'Email and password are required' });
      return;
    }

    // Look up user by email (B-AUTH-014: same error for missing email or wrong password)
    const userResult = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
      super_admin: boolean;
    }>(
      `SELECT id, email, password_hash, super_admin FROM "${schema}".users WHERE email = $1 AND active = true`,
      [email],
    );

    if (userResult.rows.length === 0) {
      json(res, 401, { error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];

    // Verify password (B-AUTH-015)
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      json(res, 401, { error: 'Invalid credentials' });
      return;
    }

    // Fetch memberships to determine roles and tenant (B-AUTH-016)
    const memberships = await pool.query<{
      tenant_id: string;
      role: string;
    }>(
      `SELECT tenant_id, role FROM "${schema}".memberships WHERE user_id = $1`,
      [user.id],
    );

    // Determine tenant and roles
    let tenantId: string | undefined;
    let roles: string[] = [];

    if (user.super_admin) {
      // B-AUTH-027: Super-admin gets app_admin role, defaults to first tenant
      roles = ['app_admin'];

      if (memberships.rows.length > 0) {
        tenantId = memberships.rows[0].tenant_id;
      } else {
        // Fallback to default tenant
        const defaultTenant = await pool.query<{ id: string }>(
          `SELECT id FROM "${schema}".tenants WHERE slug = 'default' LIMIT 1`,
        );
        if (defaultTenant.rows.length > 0) {
          tenantId = defaultTenant.rows[0].id;
        }
      }
    } else {
      if (memberships.rows.length === 0) {
        json(res, 401, { error: 'Invalid credentials' });
        return;
      }

      // Group by tenant — pick first tenant
      tenantId = memberships.rows[0].tenant_id;

      // Collect all roles for that tenant
      roles = memberships.rows
        .filter((m) => m.tenant_id === tenantId)
        .map((m) => m.role);
    }

    // Determine active role — highest privilege (B-AUTH-016)
    const activeRole = roles.sort(
      (a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0),
    )[0];

    // Sign token pair
    const payload = {
      userId: user.id,
      tenantId,
      roles,
      activeRole,
      superAdmin: user.super_admin,
      authStrategy: 'password',
    };

    // Generate access token, then use refresh() to derive a refresh token
    // refresh() verifies any valid JWT and issues a new pair
    const tempToken = await tokenProvider.sign(payload);
    const pair = await tokenProvider.refresh(tempToken);

    json(res, 200, {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });
  };
}
