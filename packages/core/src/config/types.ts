// Config type interfaces — matches docs/specs/core.md exactly.
// Provider/plugin types are forward-declared here to avoid circular imports;
// full interfaces live in their own modules.

/** Forward-declared types (full definitions in providers/types.ts, plugins/types.ts, etc.) */
export type DatabaseProvider = object;
export type APIProvider = object;
export type TokenProvider = object;
export type UIProvider = object;
export type AuthStrategy = object;
export type Plugin = object;
export type TableHooks = object;
export type TableAction = object;

export interface ProjectConfig {
  database: string;
  schema?: string;
  systemSchema?: string;
  port?: number;
  basePath?: string;
  api?: APIConfig;
  auth?: AuthConfig;
  tenancy?: TenancyConfig;
  hooks?: Record<string, TableHooks>;
  actions?: Record<string, TableAction[]>;
  providers?: ProviderOverrides;
  plugins?: Plugin[];
}

export interface APIConfig {
  graphql?: string | false;
  rest?: string | false;
  graphiql?: boolean;
  maxQueryDepth?: number;
}

export interface AuthConfig {
  secret?: string;
  accessTokenTTL?: number;
  refreshTokenTTL?: number;
  strategies?: AuthStrategyConfig[];
}

export interface AuthStrategyConfig {
  type: string;
  enabled?: boolean;
  provider?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  callbackUrl?: string;
  otpProvider?: string;
  tenantConfigurable?: boolean;
  strategy?: AuthStrategy;
}

export interface TenancyConfig {
  enabled?: boolean;
  resolution?: 'header' | 'subdomain' | 'path';
  header?: string;
}

export interface ProviderOverrides {
  database?: DatabaseProvider;
  api?: APIProvider;
  token?: TokenProvider;
  ui?: UIProvider;
}
