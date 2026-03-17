import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, HttpHandler } from '@simplicity-admin/core';
import { parseBody, json } from './helpers.js';
import type { RateLimiter } from '../rate-limit.js';
import type { RevocationStore } from '../revocation.js';

/**
 * Creates a refresh route handler.
 * POST /auth/refresh
 * Body: { refreshToken: string }
 * Returns: { accessToken, refreshToken }
 */
export function createRefreshHandler(
  tokenProvider: TokenProvider,
  rateLimiter?: RateLimiter,
  revocationStore?: RevocationStore,
): HttpHandler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (rateLimiter) {
      const ip = req.socket.remoteAddress ?? 'unknown';
      const result = rateLimiter.check(ip);
      if (!result.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter),
        });
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
      }
    }

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

    // Check revocation store (B-SEC-007: DB-backed revocation)
    if (revocationStore && (await revocationStore.isRevoked(refreshToken))) {
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
