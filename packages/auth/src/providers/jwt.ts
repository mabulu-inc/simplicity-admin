import jwt from 'jsonwebtoken';
import type { TokenProvider, TokenPayload, TokenPair } from '@simplicity-admin/core';
import type { AuthConfig } from '@simplicity-admin/core';
import { AuthError } from '../errors.js';

const DEFAULT_ACCESS_TTL = 900; // 15 minutes
const DEFAULT_REFRESH_TTL = 604800; // 7 days

interface InternalPayload extends TokenPayload {
  tokenType?: 'access' | 'refresh';
}

export function jwtTokenProvider(config?: AuthConfig): TokenProvider {
  const secret = config?.secret ?? 'development-secret';
  const accessTTL = config?.accessTokenTTL ?? DEFAULT_ACCESS_TTL;
  const refreshTTL = config?.refreshTokenTTL ?? DEFAULT_REFRESH_TTL;

  function extractPayload(decoded: InternalPayload): TokenPayload {
    return {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      roles: decoded.roles,
      activeRole: decoded.activeRole,
      superAdmin: decoded.superAdmin,
      authStrategy: decoded.authStrategy,
    };
  }

  function signAccess(payload: TokenPayload): string {
    const { userId, tenantId, roles, activeRole, superAdmin, authStrategy } = payload;
    return jwt.sign(
      { userId, tenantId, roles, activeRole, superAdmin, authStrategy, tokenType: 'access' },
      secret,
      { expiresIn: accessTTL },
    );
  }

  function signRefresh(payload: TokenPayload): string {
    const { userId, tenantId, roles, activeRole, superAdmin, authStrategy } = payload;
    return jwt.sign(
      { userId, tenantId, roles, activeRole, superAdmin, authStrategy, tokenType: 'refresh' },
      secret,
      { expiresIn: refreshTTL },
    );
  }

  return {
    name: 'jwt',
    version: '0.0.1',

    async sign(payload: TokenPayload): Promise<string> {
      return signAccess(payload);
    },

    async verify(token: string): Promise<TokenPayload> {
      try {
        const decoded = jwt.verify(token, secret) as jwt.JwtPayload & InternalPayload;
        return extractPayload(decoded);
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AuthError('Token has expired', 'AUTH_002', err);
        }
        if (err instanceof jwt.JsonWebTokenError) {
          throw new AuthError('Invalid token signature', 'AUTH_003', err);
        }
        throw err;
      }
    },

    async refresh(refreshToken: string): Promise<TokenPair> {
      let decoded: jwt.JwtPayload & InternalPayload;
      try {
        decoded = jwt.verify(refreshToken, secret) as jwt.JwtPayload & InternalPayload;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AuthError('Refresh token has expired', 'AUTH_004', err);
        }
        if (err instanceof jwt.JsonWebTokenError) {
          throw new AuthError('Invalid refresh token', 'AUTH_004', err);
        }
        throw err;
      }

      const payload = extractPayload(decoded);

      return {
        accessToken: signAccess(payload),
        refreshToken: signRefresh(payload),
      };
    },
  };
}
