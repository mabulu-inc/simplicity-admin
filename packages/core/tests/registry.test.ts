import { describe, it, expect, vi } from 'vitest';
import {
  createRegistry,
  ProviderRegistry,
  ProviderError,
} from '@simplicity-admin/core';
import type { Provider } from '@simplicity-admin/core';

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return { name: 'test-provider', version: '1.0.0', ...overrides };
}

describe('ProviderRegistry', () => {
  it('register() stores provider and get() retrieves it', () => {
    const registry = new ProviderRegistry();
    const provider = makeProvider({ name: 'my-db' });
    registry.register('database', provider);
    expect(registry.get('database')).toBe(provider);
  });

  it('get() throws ProviderError for unregistered type', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get('api')).toThrow(ProviderError);
    try {
      registry.get('api');
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as ProviderError).code).toBe('CORE_004');
      expect((e as ProviderError).message).toContain("no provider registered for 'api'");
    }
  });

  it('has() returns true for registered type', () => {
    const registry = new ProviderRegistry();
    registry.register('database', makeProvider());
    expect(registry.has('database')).toBe(true);
  });

  it('has() returns false for unregistered type', () => {
    const registry = new ProviderRegistry();
    expect(registry.has('database')).toBe(false);
  });

  it('register() overwrites previous provider for same type', () => {
    const registry = new ProviderRegistry();
    const first = makeProvider({ name: 'first' });
    const second = makeProvider({ name: 'second' });
    registry.register('database', first);
    registry.register('database', second);
    expect(registry.get('database')).toBe(second);
  });

  it('initAll() calls init() on all providers', async () => {
    const registry = new ProviderRegistry();
    const initFn = vi.fn().mockResolvedValue(undefined);
    registry.register('database', makeProvider({ init: initFn }));
    registry.register('api', makeProvider({ init: initFn }));

    const config = { database: 'postgresql://localhost/test' } as never;
    await registry.initAll(config);

    expect(initFn).toHaveBeenCalledTimes(2);
    expect(initFn).toHaveBeenCalledWith(config);
  });

  it('initAll() skips providers without init method', async () => {
    const registry = new ProviderRegistry();
    const initFn = vi.fn().mockResolvedValue(undefined);
    registry.register('database', makeProvider()); // no init
    registry.register('api', makeProvider({ init: initFn }));

    const config = { database: 'postgresql://localhost/test' } as never;
    await registry.initAll(config);

    expect(initFn).toHaveBeenCalledTimes(1);
  });

  it('initAll() wraps init errors in ProviderError', async () => {
    const registry = new ProviderRegistry();
    const originalError = new Error('connection failed');
    registry.register(
      'database',
      makeProvider({ init: vi.fn().mockRejectedValue(originalError) }),
    );

    const config = { database: 'postgresql://localhost/test' } as never;
    await expect(registry.initAll(config)).rejects.toThrow(ProviderError);

    try {
      await registry.initAll(config);
    } catch (e) {
      expect((e as ProviderError).code).toBe('CORE_005');
      expect((e as ProviderError).cause).toBe(originalError);
    }
  });

  it('shutdownAll() calls shutdown() on all providers', async () => {
    const registry = new ProviderRegistry();
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    registry.register('database', makeProvider({ shutdown: shutdownFn }));
    registry.register('api', makeProvider({ shutdown: shutdownFn }));

    await registry.shutdownAll();

    expect(shutdownFn).toHaveBeenCalledTimes(2);
  });

  it('shutdownAll() skips providers without shutdown method', async () => {
    const registry = new ProviderRegistry();
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    registry.register('database', makeProvider()); // no shutdown
    registry.register('api', makeProvider({ shutdown: shutdownFn }));

    await registry.shutdownAll();

    expect(shutdownFn).toHaveBeenCalledTimes(1);
  });

  it('get() returns correct generic type', () => {
    const registry = new ProviderRegistry();
    const provider = makeProvider({ name: 'typed' });
    registry.register('database', provider);
    const retrieved = registry.get<Provider>('database');
    expect(retrieved.name).toBe('typed');
  });
});

describe('createRegistry()', () => {
  it('returns a ProviderRegistry instance', () => {
    const config = { database: 'postgresql://localhost/test' } as never;
    const registry = createRegistry(config);
    expect(registry).toBeInstanceOf(ProviderRegistry);
  });
});
