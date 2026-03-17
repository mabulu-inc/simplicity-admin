import { createHash } from 'node:crypto';

/** SHA-256 hash a token for safe storage. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Abstraction for token revocation storage. */
export interface RevocationStore {
  /** Revoke a token. The store hashes it before persisting. */
  revoke(token: string, expiresAt: Date): Promise<void>;
  /** Check if a token has been revoked. */
  isRevoked(token: string): Promise<boolean>;
  /** Revoke all tokens for a user (token theft response). */
  revokeAllForUser(userId: string): Promise<void>;
  /** Check if all tokens for a user have been revoked. Returns the revocation timestamp or null. */
  isUserRevoked(userId: string): Promise<Date | null>;
  /** Remove expired entries. Returns count of removed entries. */
  cleanup(): Promise<number>;
}

interface RevokedEntry {
  expiresAt: Date;
}

/** In-memory revocation store (fallback for tests / environments without DB). */
export function createInMemoryRevocationStore(): RevocationStore {
  const store = new Map<string, RevokedEntry>();
  const userRevocations = new Map<string, Date>();

  return {
    async revoke(token: string, expiresAt: Date): Promise<void> {
      store.set(hashToken(token), { expiresAt });
    },
    async isRevoked(token: string): Promise<boolean> {
      return store.has(hashToken(token));
    },
    async revokeAllForUser(userId: string): Promise<void> {
      userRevocations.set(userId, new Date());
    },
    async isUserRevoked(userId: string): Promise<Date | null> {
      return userRevocations.get(userId) ?? null;
    },
    async cleanup(): Promise<number> {
      const now = Date.now();
      let removed = 0;
      for (const [key, entry] of store) {
        if (entry.expiresAt.getTime() <= now) {
          store.delete(key);
          removed++;
        }
      }
      return removed;
    },
  };
}

/** Minimal pool interface for DB-backed store — avoids importing full ConnectionPool. */
export interface RevocationPool {
  query(text: string, values: unknown[]): Promise<{ rows: unknown[]; rowCount: number }>;
}

/** Database-backed revocation store using _simplicity.revoked_tokens table. */
export function createDbRevocationStore(pool: RevocationPool): RevocationStore {
  return {
    async revoke(token: string, expiresAt: Date): Promise<void> {
      await pool.query(
        `INSERT INTO _simplicity.revoked_tokens (token_hash, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (token_hash) DO NOTHING`,
        [hashToken(token), expiresAt],
      );
    },
    async isRevoked(token: string): Promise<boolean> {
      const result = await pool.query(
        `SELECT 1 FROM _simplicity.revoked_tokens WHERE token_hash = $1`,
        [hashToken(token)],
      );
      return result.rows.length > 0;
    },
    async revokeAllForUser(userId: string): Promise<void> {
      await pool.query(
        `INSERT INTO _simplicity.user_revocations (user_id, revoked_at)
         VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET revoked_at = NOW()`,
        [userId],
      );
    },
    async isUserRevoked(userId: string): Promise<Date | null> {
      const result = await pool.query(
        `SELECT revoked_at FROM _simplicity.user_revocations WHERE user_id = $1`,
        [userId],
      );
      if (result.rows.length === 0) return null;
      return (result.rows[0] as { revoked_at: Date }).revoked_at;
    },
    async cleanup(): Promise<number> {
      const result = await pool.query(
        `DELETE FROM _simplicity.revoked_tokens WHERE expires_at <= NOW()`,
        [],
      );
      return result.rowCount;
    },
  };
}
