import { describe, it, expect } from 'vitest';
import { createPreset } from '@simplicity-admin/api';
import type { APIConfig, ConnectionPool } from '@simplicity-admin/core';

describe('createPreset', () => {
  const mockPool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {},
    withClient: async <T>(fn: (client: unknown) => Promise<T>) => fn({} as never),
  } as unknown as ConnectionPool;

  const defaultConfig: APIConfig = {
    port: 5678,
    basePath: '/api',
    graphql: '/api/graphql',
    graphiql: true,
    rest: false,
  };

  it('creates a valid PostGraphile V5 preset', () => {
    const preset = createPreset(defaultConfig, mockPool);
    expect(preset).toBeDefined();
    expect(preset.extends).toBeDefined();
    expect(Array.isArray(preset.extends)).toBe(true);
    expect(preset.extends!.length).toBeGreaterThan(0);
  });

  it('preset includes pgServices configuration', () => {
    const preset = createPreset(defaultConfig, mockPool);
    expect(preset.pgServices).toBeDefined();
    expect(Array.isArray(preset.pgServices)).toBe(true);
    expect(preset.pgServices!.length).toBe(1);
  });

  it('preset targets correct schema (public by default)', () => {
    const preset = createPreset(defaultConfig, mockPool);
    const pgService = preset.pgServices![0];
    expect(pgService.schemas).toContain('public');
  });

  it('preset configures grafserv with graphiql setting', () => {
    const preset = createPreset(defaultConfig, mockPool);
    expect(preset.grafserv).toBeDefined();
    expect(preset.grafserv!.graphiql).toBe(true);
  });

  it('preset disables graphiql when config says false', () => {
    const preset = createPreset({ ...defaultConfig, graphiql: false }, mockPool);
    expect(preset.grafserv!.graphiql).toBe(false);
  });

  it('preset includes depth limit plugin by default', () => {
    const preset = createPreset(defaultConfig, mockPool);
    expect(preset.plugins).toBeDefined();
    const depthPlugin = preset.plugins!.find(
      (p) => p.name === 'DepthLimitPlugin',
    );
    expect(depthPlugin).toBeDefined();
  });

  it('preset includes depth limit plugin with custom maxQueryDepth', () => {
    const preset = createPreset({ ...defaultConfig, maxQueryDepth: 5 }, mockPool);
    expect(preset.plugins).toBeDefined();
    const depthPlugin = preset.plugins!.find(
      (p) => p.name === 'DepthLimitPlugin',
    );
    expect(depthPlugin).toBeDefined();
  });
});
