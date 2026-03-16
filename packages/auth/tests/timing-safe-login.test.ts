import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConnectionPool, TokenProvider, QueryResult } from '@simplicity-admin/core';
import { createLoginHandler } from '../src/routes/login.js';

/**
 * Unit tests for timing-safe login (B-SEC-009).
 *
 * The login handler must call bcrypt.compare even when the user is not found,
 * so that the response time does not reveal whether an email is registered.
 */

// We mock bcrypt at the module level so we can track calls
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(false),
    hash: vi.fn().mockResolvedValue('$2b$12$dummyhash'),
  },
}));

import bcrypt from 'bcrypt';

function createMockPool(rows: Record<string, unknown>[]): ConnectionPool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
    end: vi.fn(),
  } as unknown as ConnectionPool;
}

function createMockTokenProvider(): TokenProvider {
  return {
    sign: vi.fn().mockResolvedValue('access-token'),
    verify: vi.fn().mockResolvedValue({ userId: '1' }),
    refresh: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    revoke: vi.fn(),
    isRevoked: vi.fn().mockResolvedValue(false),
  } as unknown as TokenProvider;
}

/** Simulate a POST request with a JSON body */
function simulateRequest(body: unknown): {
  req: IncomingMessage;
  res: ServerResponse;
  getResponse: () => { status: number; body: unknown };
} {
  const bodyStr = JSON.stringify(body);

  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(bodyStr.length) },
    socket: { remoteAddress: '127.0.0.1' },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') cb(Buffer.from(bodyStr));
      if (event === 'end') cb();
      return req;
    }),
    removeListener: vi.fn().mockReturnThis(),
  } as unknown as IncomingMessage;

  let statusCode = 0;
  let responseBody = '';

  const res = {
    writeHead: vi.fn((code: number) => {
      statusCode = code;
    }),
    end: vi.fn((data?: string) => {
      responseBody = data ?? '';
    }),
    setHeader: vi.fn(),
  } as unknown as ServerResponse;

  return {
    req,
    res,
    getResponse: () => ({
      status: statusCode,
      body: responseBody ? JSON.parse(responseBody) : undefined,
    }),
  };
}

describe('timing-safe login (B-SEC-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs dummy bcrypt.compare when user is not found', async () => {
    // Pool returns no rows for user lookup
    const pool = createMockPool([]);
    const tokenProvider = createMockTokenProvider();
    const handler = createLoginHandler(tokenProvider, pool, 'test_schema');

    const { req, res, getResponse } = simulateRequest({
      strategy: 'password',
      email: 'nonexistent@example.com',
      password: 'anypassword',
    });

    await handler(req, res);

    const response = getResponse();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });

    // The key assertion: bcrypt.compare MUST have been called even though user wasn't found
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('performs bcrypt.compare when user exists but password is wrong', async () => {
    // Pool returns a user row on first call, then empty memberships
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              email: 'alice@example.com',
              password_hash: '$2b$12$realhash',
              super_admin: false,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      end: vi.fn(),
    } as unknown as ConnectionPool;

    const tokenProvider = createMockTokenProvider();
    const handler = createLoginHandler(tokenProvider, pool, 'test_schema');

    const { req, res, getResponse } = simulateRequest({
      strategy: 'password',
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    await handler(req, res);

    const response = getResponse();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });

    // bcrypt.compare called with the actual hash
    expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$12$realhash');
  });

  it('both user-not-found and wrong-password return identical 401 responses', async () => {
    // Case 1: user not found
    const pool1 = createMockPool([]);
    const tokenProvider = createMockTokenProvider();
    const handler1 = createLoginHandler(tokenProvider, pool1, 'test_schema');

    const req1 = simulateRequest({
      strategy: 'password',
      email: 'nonexistent@example.com',
      password: 'anypassword',
    });
    await handler1(req1.req, req1.res);
    const response1 = req1.getResponse();

    // Case 2: wrong password
    vi.clearAllMocks();
    const pool2 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              email: 'alice@example.com',
              password_hash: '$2b$12$realhash',
              super_admin: false,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      end: vi.fn(),
    } as unknown as ConnectionPool;

    const handler2 = createLoginHandler(tokenProvider, pool2, 'test_schema');
    const req2 = simulateRequest({
      strategy: 'password',
      email: 'alice@example.com',
      password: 'wrongpassword',
    });
    await handler2(req2.req, req2.res);
    const response2 = req2.getResponse();

    // Identical responses
    expect(response1.status).toBe(response2.status);
    expect(response1.body).toEqual(response2.body);
  });
});
