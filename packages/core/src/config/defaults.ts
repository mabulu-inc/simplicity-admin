import type { APIConfig, AuthConfig, TenancyConfig } from './types.js';

export const DEFAULT_API: Required<Pick<APIConfig, 'graphql' | 'rest' | 'graphiql'>> = {
  graphql: '/api/graphql',
  rest: false,
  graphiql: false,
};

export const DEFAULT_AUTH: Required<Pick<AuthConfig, 'accessTokenTTL' | 'refreshTokenTTL' | 'strategies'>> = {
  accessTokenTTL: 900,
  refreshTokenTTL: 604800,
  strategies: [{ type: 'password' }],
};

export const DEFAULT_TENANCY: Required<Pick<TenancyConfig, 'enabled' | 'resolution' | 'header'>> = {
  enabled: false,
  resolution: 'header',
  header: 'x-tenant-id',
};

export const DEFAULT_CONFIG = {
  schema: 'public',
  systemSchema: '_simplicity_admin',
  port: 3000,
  basePath: '/admin',
  api: DEFAULT_API,
  auth: DEFAULT_AUTH,
  tenancy: DEFAULT_TENANCY,
} as const;
