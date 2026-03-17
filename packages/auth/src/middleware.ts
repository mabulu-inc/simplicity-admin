import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenProvider, ConnectionPool, ProjectConfig } from '@mabulu-inc/simplicity-admin-core';
import type { AuthenticatedRequest } from './context.js';

export type HttpMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void | Promise<void>;

export function createAuthMiddleware(
  tokenProvider: TokenProvider,
  _pool: ConnectionPool,
  _config: ProjectConfig,
): HttpMiddleware {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token — allow public route access (B-AUTH-011)
      next();
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    try {
      const payload = await tokenProvider.verify(token);
      (req as AuthenticatedRequest).user = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        roles: payload.roles,
        activeRole: payload.activeRole,
        superAdmin: payload.superAdmin ?? false,
        email: '', // email is not stored in JWT; populated from DB if needed
      };
      next();
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid token' }));
    }
  };
}
