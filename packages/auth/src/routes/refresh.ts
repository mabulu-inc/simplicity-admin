import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, HttpHandler } from '@simplicity-admin/core';
import { parseBody, json, isTokenRevoked } from './helpers.js';

/**
 * Creates a refresh route handler.
 * POST /auth/refresh
 * Body: { refreshToken: string }
 * Returns: { accessToken, refreshToken }
 */
export function createRefreshHandler(
  tokenProvider: TokenProvider,
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

    // Check revocation list (B-AUTH-017: logout invalidates refresh token)
    if (isTokenRevoked(refreshToken)) {
      json(res, 401, { error: 'Token has been revoked' });
      return;
    }

    try {
      const pair = await tokenProvider.refresh(refreshToken);
      json(res, 200, {
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
      });
    } catch {
      json(res, 401, { error: 'Invalid or expired refresh token' });
    }
  };
}
