// packages/core/src/providers/types.ts — Provider interfaces
// Matches docs/specs/core.md exactly.

import type { ProjectConfig, APIConfig } from '../config/types.js';
import type { SchemaMeta } from '../metadata/types.js';
import type { ColumnType } from '../metadata/column-types.js';

// Re-export ColumnType for convenience (used by consumers of metadata)
export type { ColumnType };

// ── Base Provider ──────────────────────────────────────────────

export interface Provider {
  name: string;
  version: string;
  init?(config: ProjectConfig): Promise<void>;
  shutdown?(): Promise<void>;
}

// ── Database Provider ──────────────────────────────────────────

export interface DatabaseProvider extends Provider {
  connect(url: string): Promise<ConnectionPool>;
  introspect(pool: ConnectionPool, schema?: string): Promise<SchemaMeta>;
  migrate(pool: ConnectionPool, config: MigrationConfig): Promise<MigrationResult>;
  generate(pool: ConnectionPool, outputDir: string, schema?: string): Promise<void>;
}

// ── API Provider ───────────────────────────────────────────────

export interface APIProvider extends Provider {
  createHandler(pool: ConnectionPool, meta: SchemaMeta, config: APIConfig): Promise<HttpHandler>;
}

// ── Token Provider ─────────────────────────────────────────────

export interface TokenProvider extends Provider {
  sign(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
  refresh(refreshToken: string): Promise<TokenPair>;
}

// ── Auth Strategy ──────────────────────────────────────────────

export interface AuthStrategy extends Provider {
  type: string;
  displayName: string;
  icon?: string;

  authenticate?(
    credentials: Record<string, unknown>,
    pool: ConnectionPool,
  ): Promise<AuthResult>;

  getAuthorizationUrl?(
    state: string,
    redirectUri: string,
    tenantId?: string,
  ): Promise<string>;

  handleCallback?(
    params: Record<string, unknown>,
    pool: ConnectionPool,
  ): Promise<AuthResult>;

  isAvailableForTenant?(tenantId: string, pool: ConnectionPool): Promise<boolean>;
}

export interface AuthResult {
  userId: string;
  email: string;
  provisionUser?: boolean;
  profile?: Record<string, unknown>;
}

// ── Table Hooks ────────────────────────────────────────────────

export interface TableHooks {
  beforeInsert?(data: Record<string, unknown>, ctx: HookContext): Promise<Record<string, unknown> | void>;
  afterInsert?(data: Record<string, unknown>, ctx: HookContext): Promise<void>;
  beforeUpdate?(data: Record<string, unknown>, ctx: HookContext): Promise<Record<string, unknown> | void>;
  afterUpdate?(data: Record<string, unknown>, ctx: HookContext): Promise<void>;
  beforeDelete?(id: string | string[], ctx: HookContext): Promise<void>;
  afterDelete?(id: string | string[], ctx: HookContext): Promise<void>;
  validate?(data: Record<string, unknown>, operation: 'insert' | 'update', ctx: HookContext): Promise<void>;
}

export interface HookContext {
  pool: ConnectionPool;
  userId: string;
  tenantId?: string;
  activeRole: string;
  table: string;
  existing?: Record<string, unknown>;
}

// ── Table Actions ──────────────────────────────────────────────

export interface TableAction {
  name: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  condition?: (row: Record<string, unknown>, ctx: ActionContext) => boolean;
  roles?: string[];
  bulk?: boolean;
  placement?: Array<'row' | 'toolbar' | 'detail'>;
  confirm?: string | { title: string; message: string };
  handler: (rows: Record<string, unknown>[], ctx: ActionContext) => Promise<ActionResult>;
}

export interface ActionContext extends HookContext {
  action: string;
}

export interface ActionResult {
  message?: string;
  refresh?: boolean;
  redirect?: string;
}

// ── UI Provider ────────────────────────────────────────────────

/** UIConfig is defined in the UI package; forward-declared here as object until available. */
export type UIConfig = object;

export interface UIProvider extends Provider {
  createApp(config: UIConfig): Promise<HttpHandler>;
}

// ── HTTP & Connection Types ────────────────────────────────────

import type { IncomingMessage, ServerResponse } from 'node:http';

export type HttpHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

// ── Token Types ────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  tenantId?: string;
  roles: string[];
  activeRole: string;
  superAdmin?: boolean;
  authStrategy: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Connection Pool ────────────────────────────────────────────

export interface ConnectionPool {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** Opaque client type — actual implementation provided by database provider. */
export type PoolClient = object;

// ── Migration Types ────────────────────────────────────────────

export interface MigrationConfig {
  schemaDir: string;
  schema?: string;
  allowDestructive?: boolean;
}

export interface MigrationResult {
  applied: number;
  operations: string[];
}
