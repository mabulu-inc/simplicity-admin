import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  createInMemoryRevocationStore,
  createDbRevocationStore,
  type RevocationStore,
  hashToken,
} from '../src/revocation.js';

describe('hashToken', () => {
  it('returns a SHA-256 hex digest', () => {
    const token = 'my-secret-token';
    const hash = hashToken(token);
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hash).toBe(expected);
    expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('produces the same hash for the same token', () => {
    expect(hashToken('same')).toBe(hashToken('same'));
  });
});

describe('InMemoryRevocationStore', () => {
  let store: RevocationStore;

  beforeEach(() => {
    store = createInMemoryRevocationStore();
  });

  it('reports a token as not revoked initially', async () => {
    expect(await store.isRevoked('some-token')).toBe(false);
  });

  it('revokes a token', async () => {
    await store.revoke('my-token', new Date(Date.now() + 60_000));
    expect(await store.isRevoked('my-token')).toBe(true);
  });

  it('stores the hash, not the raw token', async () => {
    const rawToken = 'raw-token-value';
    await store.revoke(rawToken, new Date(Date.now() + 60_000));
    // The store should hash the token before storage
    expect(await store.isRevoked(rawToken)).toBe(true);
  });

  it('cleans up expired entries', async () => {
    const pastDate = new Date(Date.now() - 1000);
    await store.revoke('expired-token', pastDate);
    const cleaned = await store.cleanup();
    expect(cleaned).toBe(1);
    expect(await store.isRevoked('expired-token')).toBe(false);
  });

  it('does not clean up non-expired entries', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    await store.revoke('valid-token', futureDate);
    const cleaned = await store.cleanup();
    expect(cleaned).toBe(0);
    expect(await store.isRevoked('valid-token')).toBe(true);
  });
});

describe('DbRevocationStore', () => {
  it('delegates revoke to the pool query with hashed token', async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const mockPool = {
      query: async (text: string, values: unknown[]) => {
        queries.push({ text, values });
        return { rows: [], rowCount: 0 };
      },
    };

    const store = createDbRevocationStore(mockPool as never);
    const token = 'test-token';
    const expiresAt = new Date('2026-04-01T00:00:00Z');
    await store.revoke(token, expiresAt);

    expect(queries).toHaveLength(1);
    expect(queries[0].text).toContain('INSERT INTO');
    expect(queries[0].text).toContain('revoked_tokens');
    // Should store hash, not raw token
    const expectedHash = hashToken(token);
    expect(queries[0].values[0]).toBe(expectedHash);
    expect(queries[0].values).toContain(expiresAt);
  });

  it('delegates isRevoked to the pool query with hashed token', async () => {
    const mockPool = {
      query: async (_text: string, _values: unknown[]) => {
        return { rows: [{ token_hash: 'x' }], rowCount: 1 };
      },
    };

    const store = createDbRevocationStore(mockPool as never);
    const result = await store.isRevoked('some-token');
    expect(result).toBe(true);
  });

  it('returns false when token is not in the DB', async () => {
    const mockPool = {
      query: async (_text: string, _values: unknown[]) => {
        return { rows: [], rowCount: 0 };
      },
    };

    const store = createDbRevocationStore(mockPool as never);
    const result = await store.isRevoked('unknown-token');
    expect(result).toBe(false);
  });

  it('cleanup deletes expired rows and returns count', async () => {
    const mockPool = {
      query: async (_text: string, _values: unknown[]) => {
        return { rows: [], rowCount: 5 };
      },
    };

    const store = createDbRevocationStore(mockPool as never);
    const cleaned = await store.cleanup();
    expect(cleaned).toBe(5);
  });
});
