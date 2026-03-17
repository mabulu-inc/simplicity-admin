import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigError, defineConfig } from '@mabulu-inc/simplicity-admin-core';

describe('JWT secret validation', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('production guard', () => {
    it('throws ConfigError when secret is "development-secret" in production', async () => {
      process.env.NODE_ENV = 'production';
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      expect(() => jwtTokenProvider({ secret: 'development-secret' })).toThrow(
        /development.?secret/i,
      );
      try {
        jwtTokenProvider({ secret: 'development-secret' });
        expect.unreachable('should have thrown');
      } catch (err: unknown) {
        expect((err as { name: string }).name).toBe('ConfigError');
        expect((err as { code: string }).code).toBe('AUTH_010');
      }
    });

    it('throws ConfigError when secret is shorter than 32 characters in production', async () => {
      process.env.NODE_ENV = 'production';
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      expect(() => jwtTokenProvider({ secret: 'short-secret' })).toThrow(/32/);
      try {
        jwtTokenProvider({ secret: 'short-secret' });
        expect.unreachable('should have thrown');
      } catch (err: unknown) {
        expect((err as { name: string }).name).toBe('ConfigError');
        expect((err as { code: string }).code).toBe('AUTH_010');
      }
    });

    it('throws ConfigError when no secret is provided in production', async () => {
      process.env.NODE_ENV = 'production';
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      try {
        jwtTokenProvider();
        expect.unreachable('should have thrown');
      } catch (err: unknown) {
        expect((err as { name: string }).name).toBe('ConfigError');
      }
    });

    it('accepts a strong secret (>= 32 chars) in production', async () => {
      process.env.NODE_ENV = 'production';
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      const strongSecret = 'a-very-strong-production-secret-that-is-long-enough';
      expect(() => jwtTokenProvider({ secret: strongSecret })).not.toThrow();
    });
  });

  describe('development mode', () => {
    it('allows default secret in development with a warning', async () => {
      process.env.NODE_ENV = 'development';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      expect(() => jwtTokenProvider()).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/development.?secret/i),
      );
    });

    it('does not warn when a strong secret is provided in development', async () => {
      process.env.NODE_ENV = 'development';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { jwtTokenProvider } = await import('@mabulu-inc/simplicity-admin-auth');
      const strongSecret = 'a-very-strong-production-secret-that-is-long-enough';
      jwtTokenProvider({ secret: strongSecret });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

describe('GraphiQL default', () => {
  it('defaults graphiql to false', () => {
    const config = defineConfig({ database: 'postgresql://localhost/test' });
    expect(config.api.graphiql).toBe(false);
  });
});

describe('Config schema secret validation', () => {
  it('rejects auth.secret shorter than 32 characters', () => {
    expect(() =>
      defineConfig({ database: 'postgresql://localhost/test', auth: { secret: 'short' } }),
    ).toThrow(ConfigError);
  });

  it('accepts auth.secret of 32+ characters', () => {
    const secret = 'a'.repeat(32);
    expect(() =>
      defineConfig({ database: 'postgresql://localhost/test', auth: { secret } }),
    ).not.toThrow();
  });

  it('allows omitting auth.secret entirely', () => {
    expect(() =>
      defineConfig({ database: 'postgresql://localhost/test' }),
    ).not.toThrow();
  });
});
