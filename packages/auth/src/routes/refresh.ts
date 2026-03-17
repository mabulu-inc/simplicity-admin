import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, HttpHandler } from '@mabulu-inc/simplicity-admin-core';
import { parseBody, json } from './helpers.js';
import type { RateLimiter } from '../rate-limit.js';
import type { RevocationStore } from '../revocation.js';

/** Default TTL for revoked token entries (7 days). */
const REVOCATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates a refresh route handler with token rotation (B-SEC-010).
 * POST /auth/refresh
 * Body: { refreshToken: string }
 * Returns: { accessToken, refreshToken }
 *
 * - On success the old refresh token is revoked (single-use).
 * - Reuse of a revoked token triggers user-level revocation (theft response).
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

    // Verify the token signature and extract payload (needed for user-level checks)
    let payload: Awaited<ReturnType<TokenProvider['verify']>>;
    try {
      payload = await tokenProvider.verify(refreshToken);
    } catch {
      json(res, 401, { error: 'Invalid or expired refresh token' });
      return;
    }

    if (revocationStore) {
      // Check user-level revocation first
      const userRevokedAt = await revocationStore.isUserRevoked(payload.userId);
      if (userRevokedAt) {
        json(res, 401, { error: 'Token has been revoked' });
        return;
      }

      // B-SEC-010: If the token was already revoked, this is a reuse attempt (theft detection)
      if (await revocationStore.isRevoked(refreshToken)) {
        await revocationStore.revokeAllForUser(payload.userId);
        json(res, 401, { error: 'Token has been revoked' });
        return;
      }
    }

    try {
      const pair = await tokenProvider.refresh(refreshToken);

      // B-SEC-010: Revoke the old refresh token (single-use rotation)
      if (revocationStore) {
        const expiresAt = new Date(Date.now() + REVOCATION_TTL_MS);
        await revocationStore.revoke(refreshToken, expiresAt);
      }

      json(res, 200, {
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
      });
    } catch {
      json(res, 401, { error: 'Invalid or expired refresh token' });
    }
  };
}
