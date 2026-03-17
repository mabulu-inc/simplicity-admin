import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, ConnectionPool, HttpHandler } from '@simplicity-admin/core';
import { parseBody, json } from './helpers.js';
import type { RevocationStore } from '../revocation.js';

/**
 * Creates a logout route handler.
 * POST /auth/logout
 * Body: { refreshToken: string }
 * Invalidates the refresh token so it cannot be used again.
 */
export function createLogoutHandler(
  tokenProvider: TokenProvider,
  _pool: ConnectionPool,
  _schema: string,
  revocationStore?: RevocationStore,
): HttpHandler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let body: Record<string, unknown>;
    try {
      body = await parseBody(req);
    } catch {
      json(res, 400, { error: 'Invalid request body' });
      return;
    }

    const { refreshToken } = body as { refreshToken?: string };

    if (!refreshToken) {
      json(res, 400, { error: 'Refresh token is required' });
      return;
    }

    // Verify the token is valid before revoking (optional — we revoke either way)
    try {
      await tokenProvider.verify(refreshToken);
    } catch {
      // Token is already invalid/expired — still return 200
    }

    // Add to revocation store (B-SEC-007: DB-backed revocation)
    // Default expiry: 7 days (matches refresh token TTL)
    if (revocationStore) {
      const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await revocationStore.revoke(refreshToken, defaultExpiry);
    }

    json(res, 200, { success: true });
  };
}
