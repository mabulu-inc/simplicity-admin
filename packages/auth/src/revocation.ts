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
  /** Remove expired entries. Returns count of removed entries. */
  cleanup(): Promise<number>;
}

interface RevokedEntry {
  expiresAt: Date;
}

/** In-memory revocation store (fallback for tests / environments without DB). */
export function createInMemoryRevocationStore(): RevocationStore {
  const store = new Map<string, RevokedEntry>();

  return {
    async revoke(token: string, expiresAt: Date): Promise<void> {
      store.set(hashToken(token), { expiresAt });
    },
    async isRevoked(token: string): Promise<boolean> {
      return store.has(hashToken(token));
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

/** Database-backed revocation store using _simplicity_admin.revoked_tokens table. */
export function createDbRevocationStore(pool: RevocationPool): RevocationStore {
  return {
    async revoke(token: string, expiresAt: Date): Promise<void> {
      await pool.query(
        `INSERT INTO _simplicity_admin.revoked_tokens (token_hash, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (token_hash) DO NOTHING`,
        [hashToken(token), expiresAt],
      );
    },
    async isRevoked(token: string): Promise<boolean> {
      const result = await pool.query(
        `SELECT 1 FROM _simplicity_admin.revoked_tokens WHERE token_hash = $1`,
        [hashToken(token)],
      );
      return result.rows.length > 0;
    },
    async cleanup(): Promise<number> {
      const result = await pool.query(
        `DELETE FROM _simplicity_admin.revoked_tokens WHERE expires_at <= NOW()`,
        [],
      );
      return result.rowCount;
    },
  };
}
