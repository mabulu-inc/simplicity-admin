# Core Module Specification

**PRD Reference:** §2, §5

## Overview

The core module (`@mabulu-inc/simplicity-admin-core`) is the foundation of the framework. It defines the config system, metadata types, provider interfaces, and plugin lifecycle. It has ZERO dependencies on other `@simplicity-admin` packages — all other packages depend on it.

## Package Location

- Package: `@mabulu-inc/simplicity-admin-core`
- Source: `packages/core/src/`
- Tests: `packages/core/tests/`

## Dependencies

- `zod` — config validation
- No other `@simplicity-admin` packages

## Public API

### Config Types

```typescript
// packages/core/src/config/types.ts

export interface ProjectConfig {
  database: string;
  schema?: string;                    // default: 'public'
  systemSchema?: string;              // default: '_simplicity'
  port?: number;                      // default: 3000
  basePath?: string;                  // default: '/admin'
  api?: APIConfig;
  auth?: AuthConfig;
  tenancy?: TenancyConfig;
  hooks?: Record<string, TableHooks>;     // Per-table data lifecycle hooks (keyed by table name)
  actions?: Record<string, TableAction[]>; // Per-table custom actions (keyed by table name)
  providers?: ProviderOverrides;
  plugins?: Plugin[];
}

export interface APIConfig {
  graphql?: string | false;           // default: '/api/graphql'
  rest?: string | false;              // default: false
  graphiql?: boolean;                 // default: true (dev only)
}

export interface AuthConfig {
  secret?: string;                    // required in production
  accessTokenTTL?: number;            // default: 900 (15 min)
  refreshTokenTTL?: number;           // default: 604800 (7 days)
  strategies?: AuthStrategyConfig[];  // default: [{ type: 'password' }]
}

export interface AuthStrategyConfig {
  /** Strategy type: 'password' | 'oauth' | 'otp' */
  type: string;
  /** Whether this strategy is active (default: true) */
  enabled?: boolean;
  /** OAuth provider: 'office365' | 'google' | 'github' | custom string */
  provider?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** OAuth scopes to request */
  scopes?: string[];
  /** OAuth/SAML callback URL override */
  callbackUrl?: string;
  /** OTP provider: 'twilio' | custom string */
  otpProvider?: string;
  /** Allow tenants to configure their own instances of this strategy */
  tenantConfigurable?: boolean;
  /** Custom AuthStrategy implementation (overrides built-in) */
  strategy?: AuthStrategy;
}

export interface TenancyConfig {
  enabled?: boolean;                  // default: false
  resolution?: 'header' | 'subdomain' | 'path';  // default: 'header'
  header?: string;                    // default: 'x-tenant-id'
}

export interface ProviderOverrides {
  database?: DatabaseProvider;
  api?: APIProvider;
  token?: TokenProvider;
  ui?: UIProvider;
}
```

### Config Functions

```typescript
// packages/core/src/config/schema.ts
export function defineConfig(config: Partial<ProjectConfig>): ProjectConfig;

// packages/core/src/config/loader.ts
export function loadConfig(path?: string): Promise<ProjectConfig>;
export function resolveConfig(
  fileConfig: Partial<ProjectConfig>,
  envOverrides: Record<string, string>
): ProjectConfig;
```

### Metadata Types

```typescript
// packages/core/src/metadata/types.ts

export type ColumnType =
  | 'text' | 'varchar' | 'char'
  | 'integer' | 'bigint' | 'smallint' | 'serial' | 'bigserial'
  | 'numeric' | 'decimal' | 'real' | 'double'
  | 'boolean'
  | 'date' | 'timestamp' | 'timestamptz' | 'time' | 'timetz'
  | 'uuid'
  | 'json' | 'jsonb'
  | 'enum'
  | 'array'
  | 'unknown';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  pgType: string;              // Raw PostgreSQL type name
  nullable: boolean;
  hasDefault: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isGenerated: boolean;
  enumValues?: string[];       // Only when type === 'enum'
  arrayElementType?: ColumnType; // Only when type === 'array'
  comment: string | null;
  maxLength?: number;          // For varchar(N)
  precision?: number;          // For numeric(P,S)
  scale?: number;
}

export interface TableMeta {
  name: string;
  schema: string;
  columns: ColumnMeta[];
  primaryKey: string[];        // Column names forming PK
  comment: string | null;
}

export interface RelationMeta {
  name: string;                // Constraint name
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  type: 'many-to-one' | 'one-to-many';
}

export interface EnumMeta {
  name: string;
  schema: string;
  values: string[];
}

export interface SchemaMeta {
  tables: TableMeta[];
  relations: RelationMeta[];
  enums: EnumMeta[];
}
```

### Provider Interfaces

```typescript
// packages/core/src/providers/types.ts

export interface Provider {
  name: string;
  version: string;
  init?(config: ProjectConfig): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface DatabaseProvider extends Provider {
  connect(url: string): Promise<ConnectionPool>;
  introspect(pool: ConnectionPool, schema?: string): Promise<SchemaMeta>;
  migrate(pool: ConnectionPool, config: MigrationConfig): Promise<MigrationResult>;
  generate(pool: ConnectionPool, outputDir: string, schema?: string): Promise<void>;
}

export interface APIProvider extends Provider {
  createHandler(pool: ConnectionPool, meta: SchemaMeta, config: APIConfig): Promise<HttpHandler>;
}

export interface TokenProvider extends Provider {
  sign(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
  refresh(refreshToken: string): Promise<TokenPair>;
}

export interface AuthStrategy extends Provider {
  /** Strategy type identifier: 'password' | 'oauth' | 'otp' */
  type: string;
  /** Human-readable label for the login page (e.g., "Sign in with Office 365") */
  displayName: string;
  /** Icon identifier for the login page button */
  icon?: string;

  /**
   * For direct credential strategies (password, OTP).
   * Returns an AuthResult on success, throws AuthError on failure.
   */
  authenticate?(
    credentials: Record<string, unknown>,
    pool: ConnectionPool
  ): Promise<AuthResult>;

  /**
   * For redirect-based strategies (OAuth, SAML).
   * Returns the URL to redirect the user to.
   */
  getAuthorizationUrl?(
    state: string,
    redirectUri: string,
    tenantId?: string
  ): Promise<string>;

  /**
   * For redirect-based strategies.
   * Handles the callback after the external provider redirects back.
   */
  handleCallback?(
    params: Record<string, unknown>,
    pool: ConnectionPool
  ): Promise<AuthResult>;

  /**
   * Whether this strategy is available for a given tenant.
   * Defaults to true if not implemented. Used for per-tenant strategy filtering.
   */
  isAvailableForTenant?(tenantId: string, pool: ConnectionPool): Promise<boolean>;
}

export interface AuthResult {
  userId: string;
  email: string;
  /** If true, the user should be auto-provisioned on first login (e.g., OAuth first-time flow) */
  provisionUser?: boolean;
  /** Profile data from external provider (name, avatar, etc.) */
  profile?: Record<string, unknown>;
}

/**
 * Per-table data lifecycle hooks.
 * "before" hooks can modify data or throw to abort.
 * "after" hooks are for side effects (notifications, logging, sync).
 */
export interface TableHooks {
  beforeInsert?(data: Record<string, unknown>, ctx: HookContext): Promise<Record<string, unknown> | void>;
  afterInsert?(data: Record<string, unknown>, ctx: HookContext): Promise<void>;
  beforeUpdate?(data: Record<string, unknown>, ctx: HookContext): Promise<Record<string, unknown> | void>;
  afterUpdate?(data: Record<string, unknown>, ctx: HookContext): Promise<void>;
  beforeDelete?(id: string | string[], ctx: HookContext): Promise<void>;
  afterDelete?(id: string | string[], ctx: HookContext): Promise<void>;
  /** Validate data before insert or update. Throw a ValidationError to reject. */
  validate?(data: Record<string, unknown>, operation: 'insert' | 'update', ctx: HookContext): Promise<void>;
}

export interface HookContext {
  pool: ConnectionPool;
  userId: string;
  tenantId?: string;
  activeRole: string;
  table: string;
  /** The existing row (populated for update/delete, undefined for insert) */
  existing?: Record<string, unknown>;
}

/**
 * A custom action that appears in the UI when conditions are met.
 * Defined per-table in config.actions.
 */
export interface TableAction {
  /** Unique identifier for this action (used in API routes and _actions array) */
  name: string;
  /** Button label shown in the UI */
  label: string;
  /** Icon identifier for the button */
  icon?: string;
  /** Visual style hint */
  variant?: 'default' | 'danger' | 'success' | 'warning';

  /**
   * When should this action be available?
   * Evaluated server-side per row. Return true to show the action.
   * If omitted, the action is always available.
   */
  condition?: (row: Record<string, unknown>, ctx: ActionContext) => boolean;

  /** Roles that can see and execute this action. If omitted, any role with table access can use it. */
  roles?: string[];

  /** Allow selecting multiple rows and applying this action in bulk (default: false) */
  bulk?: boolean;

  /** Where the action button appears (default: ['row', 'detail']) */
  placement?: Array<'row' | 'toolbar' | 'detail'>;

  /** Confirmation prompt before executing. String = simple message, object = custom title + message. */
  confirm?: string | { title: string; message: string };

  /**
   * The business logic. Receives the target row(s) and full context.
   * Return a result to control the UI response (toast, redirect, refresh).
   */
  handler: (rows: Record<string, unknown>[], ctx: ActionContext) => Promise<ActionResult>;
}

export interface ActionContext extends HookContext {
  /** The action being executed */
  action: string;
}

export interface ActionResult {
  /** Message shown in a toast notification after the action completes */
  message?: string;
  /** Refresh the current view after the action (default: true) */
  refresh?: boolean;
  /** Redirect to a different path after the action */
  redirect?: string;
}

export interface UIProvider extends Provider {
  createApp(config: UIConfig): Promise<HttpHandler>;
}

export type HttpHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export interface TokenPayload {
  userId: string;
  tenantId?: string;        // Undefined when super-admin is in global mode
  roles: string[];          // All roles assigned to this user
  activeRole: string;       // Currently selected role (drives RBAC/UI)
  superAdmin?: boolean;     // System-level flag — bypasses tenant membership, can enter global mode
  authStrategy: string;     // Strategy used to authenticate this session (e.g., 'password', 'oauth:office365')
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ConnectionPool {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface MigrationConfig {
  schemaDir: string;
  schema?: string;
  allowDestructive?: boolean;
}

export interface MigrationResult {
  applied: number;
  operations: string[];
}
```

### Provider Registry

```typescript
// packages/core/src/providers/registry.ts

export class ProviderRegistry {
  register<T extends Provider>(type: string, provider: T): void;
  get<T extends Provider>(type: string): T;
  has(type: string): boolean;
  initAll(config: ProjectConfig): Promise<void>;
  shutdownAll(): Promise<void>;
}

export function createRegistry(config: ProjectConfig): ProviderRegistry;
```

### Plugin Types

```typescript
// packages/core/src/plugins/types.ts

export interface Plugin {
  name: string;
  version: string;
  onInit?(config: ProjectConfig): Promise<void>;
  onSchemaLoaded?(meta: SchemaMeta): Promise<SchemaMeta>;
  onReady?(ctx: AppContext): Promise<void>;
  onRequest?(req: IncomingMessage, ctx: RequestContext): Promise<void>;
  onShutdown?(): Promise<void>;
}

export interface AppContext {
  config: ProjectConfig;
  registry: ProviderRegistry;
  meta: SchemaMeta;
}

export interface RequestContext {
  userId?: string;
  tenantId?: string;
  roles?: string[];
  activeRole?: string;
  superAdmin?: boolean;
}
```

### Plugin Manager

```typescript
// packages/core/src/plugins/manager.ts

export class PluginManager {
  constructor(plugins: Plugin[]);
  runHook<K extends keyof Plugin>(hook: K, ...args: Parameters<NonNullable<Plugin[K]>>): Promise<ReturnType<NonNullable<Plugin[K]>>>;
}
```

## Behavior Specification

### B-CORE-001: Config Validation
**Given** a config object with `database: "postgres://localhost/mydb"`
**When** `defineConfig()` is called
**Then** returns a complete `ProjectConfig` with all defaults applied

### B-CORE-002: Config Validation — Missing Database
**Given** a config object without a `database` field
**When** `defineConfig()` is called
**Then** throws a `ConfigError` with message containing "database is required"

### B-CORE-003: Config Validation — Invalid Types
**Given** a config object with `port: "not-a-number"`
**When** `defineConfig()` is called
**Then** throws a `ConfigError` with message describing the type mismatch

### B-CORE-004: Config Defaults Applied
**Given** a config object with only `database` specified
**When** `defineConfig()` is called
**Then** result has `schema: 'public'`, `port: 3000`, `basePath: '/admin'`, `api.graphql: '/api/graphql'`, `api.rest: false`, `tenancy.enabled: false`

### B-CORE-004b: Schema Config — Custom Schema
**Given** a config object with `schema: 'crm'`
**When** `defineConfig()` is called
**Then** result has `schema: 'crm'` — the framework introspects and generates CRUD/API/UI for only the `crm` schema, leaving other schemas untouched

### B-CORE-005: Config Loader — File Resolution
**Given** a `simplicity-admin.config.ts` file exists in the current directory
**When** `loadConfig()` is called without arguments
**Then** loads and validates the config from that file

### B-CORE-006: Config Loader — Env Override
**Given** a config file with `port: 3000` and env var `SIMPLICITY_ADMIN_PORT=4000`
**When** `loadConfig()` is called
**Then** result has `port: 4000` (env overrides file)

### B-CORE-007: Provider Registry — Register and Get
**Given** a provider registry
**When** `register('database', myProvider)` then `get('database')` is called
**Then** returns the registered provider

### B-CORE-008: Provider Registry — Missing Provider
**Given** a provider registry with no 'api' provider registered
**When** `get('api')` is called
**Then** throws a `ProviderError` with message containing "no provider registered for 'api'"

### B-CORE-009: Provider Registry — Init All
**Given** a registry with two providers that have `init()` methods
**When** `initAll(config)` is called
**Then** both providers' `init()` methods are called with the config

### B-CORE-010: Plugin Manager — Hook Execution Order
**Given** a plugin manager with plugins [A, B, C] and all have `onInit`
**When** `runHook('onInit', config)` is called
**Then** plugins execute in order: A.onInit → B.onInit → C.onInit

### B-CORE-011: Plugin Manager — Schema Transform Chain
**Given** a plugin A with `onSchemaLoaded` that adds a virtual table and plugin B that is identity
**When** `runHook('onSchemaLoaded', meta)` is called
**Then** the result includes A's transformation passed through B

### Data Hooks

### B-CORE-015: beforeInsert — Modify Data
**Given** config has `hooks: { contacts: { beforeInsert: async (data) => ({ ...data, source: 'admin' }) } }`
**When** a contact is inserted via the API
**Then** the `source` field is set to `'admin'` before the row reaches the database

### B-CORE-016: beforeInsert — Abort
**Given** config has `hooks: { contacts: { beforeInsert: async (data) => { throw new ValidationError('Duplicate detected') } } }`
**When** a contact insert is attempted
**Then** the insert is aborted, and the API responds with 400 and the validation error message

### B-CORE-017: afterInsert — Side Effect
**Given** config has `hooks: { deals: { afterInsert: async (data, ctx) => { /* send Slack notification */ } } }`
**When** a deal is inserted
**Then** the hook runs after the row is committed — the insert succeeds even if the hook throws (after-hooks do not roll back)

### B-CORE-018: validate — Runs Before Insert and Update
**Given** config has `hooks: { contacts: { validate: async (data, op) => { if (!data.email?.includes('@')) throw new ValidationError('Invalid email') } } }`
**When** a contact is inserted or updated with `email: "notanemail"`
**Then** the operation is rejected with the validation error — `validate` runs before `beforeInsert`/`beforeUpdate`

### B-CORE-019: beforeUpdate — Access Existing Row
**Given** config has `hooks: { deals: { beforeUpdate: async (data, ctx) => { if (ctx.existing.stage === 'closed' && data.stage !== 'closed') throw new ValidationError('Cannot reopen closed deals') } } }`
**When** a closed deal is updated with `stage: 'open'`
**Then** the update is rejected — `ctx.existing` contains the current row before modification

### B-CORE-020: Hook Execution Order
**Given** a table has `validate`, `beforeInsert`, and `afterInsert` hooks
**When** a row is inserted
**Then** hooks execute in order: `validate` → `beforeInsert` → DB insert → `afterInsert`

### Custom Actions

### B-CORE-022: Action — Condition Met
**Given** config defines action `approve` on `orders` with `condition: (row) => row.status === 'pending'`
**When** the API returns an order with `status: 'pending'`
**Then** the row includes `_actions: ['approve']` and the UI renders an "Approve" button

### B-CORE-023: Action — Condition Not Met
**Given** the same `approve` action with `condition: (row) => row.status === 'pending'`
**When** the API returns an order with `status: 'shipped'`
**Then** `_actions` does not include `'approve'` and no "Approve" button appears

### B-CORE-024: Action — Execute
**Given** action `approve` with `handler: async (rows, ctx) => { /* update status to approved */ return { message: 'Order approved' } }`
**When** the user clicks "Approve" on a pending order
**Then** POST `/api/actions/orders/approve` is called with the row ID, the handler executes, and the UI shows the toast "Order approved" and refreshes the view

### B-CORE-025: Action — Server Re-checks Condition
**Given** order was `pending` when the page loaded, but another user shipped it before the action was clicked
**When** POST `/api/actions/orders/approve` is called
**Then** the server re-evaluates the condition, finds `status: 'shipped'`, and responds with 409 Conflict: "Action 'approve' is no longer available for this record"

### B-CORE-026: Action — RBAC
**Given** action `delete_batch` on `contacts` with `roles: ['app_admin']`
**When** a user with `activeRole: 'app_editor'` views a contact
**Then** `_actions` does not include `'delete_batch'` — the action is invisible to non-admin roles

### B-CORE-027: Action — Bulk
**Given** action `archive` on `projects` with `bulk: true`
**When** the user selects 5 projects in the DataTable and clicks "Archive"
**Then** POST `/api/actions/projects/archive` is called with all 5 row IDs, and the handler receives all 5 rows

### B-CORE-028: Action — Confirmation
**Given** action `close_deal` with `confirm: 'This will lock the deal. Continue?'`
**When** the user clicks "Close Deal"
**Then** a confirmation dialog appears with the message before the action executes — cancelling the dialog does not invoke the handler

### B-CORE-029: Action — No Condition (Always Available)
**Given** action `export_pdf` on `invoices` with no `condition` defined
**When** any invoice row is rendered
**Then** `_actions` always includes `'export_pdf'`

### B-CORE-030: Action — Redirect After Execution
**Given** action `create_invoice` on `deals` with `handler` returning `{ redirect: '/admin/invoices/INV-123' }`
**When** the action completes
**Then** the UI navigates to `/admin/invoices/INV-123` instead of refreshing the current view

### B-CORE-012: Column Type Mapping
**Given** no hooks are configured for the `products` table
**When** a product is inserted
**Then** the operation proceeds directly to the database with no interception

### B-CORE-012: Column Type Mapping
**Given** a PostgreSQL type string `"character varying"`
**When** mapped through `mapPgType()`
**Then** returns `ColumnType.varchar`

### B-CORE-013: Column Type Mapping — All PG Types
**Given** each supported PostgreSQL type (integer, bigint, text, boolean, uuid, jsonb, timestamptz, etc.)
**When** mapped through `mapPgType()`
**Then** each returns the correct `ColumnType` value

### B-CORE-014: Column Type Mapping — Unknown Type
**Given** an unrecognized PostgreSQL type `"my_custom_type"`
**When** mapped through `mapPgType()`
**Then** returns `ColumnType.unknown`

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Missing required config field | ConfigError | CORE_001 | Throw with field name and expected type |
| Invalid config value type | ConfigError | CORE_002 | Throw with field path, expected type, received type |
| Config file not found | ConfigError | CORE_003 | Throw with searched paths |
| Provider not registered | ProviderError | CORE_004 | Throw with provider type name |
| Provider init failure | ProviderError | CORE_005 | Throw with provider name and original error |
| Plugin hook failure | PluginError | CORE_006 | Throw with plugin name, hook name, and original error |
| Validation hook rejected operation | ValidationError | CORE_007 | 400 response with validation message |
| Before-hook threw non-validation error | HookError | CORE_008 | 500 response, log error, abort operation |
| After-hook failure | HookError | CORE_009 | Log error, do NOT roll back (data already committed) |
| Action condition no longer met | ActionError | CORE_010 | 409 Conflict: "Action is no longer available for this record" |
| Action not found | ActionError | CORE_011 | 404: "Unknown action 'X' on table 'Y'" |
| Action handler failure | ActionError | CORE_012 | 500: log error, return "Action failed" |

## Security Considerations

- Config may contain secrets (JWT secret, database password in URL). The config loader must NEVER log the full config object.
- Environment variable resolution must sanitize against injection.
- Provider interfaces must not expose internal state (e.g., connection pool internals).

## Test Requirements

### Unit Tests
- [ ] `defineConfig()` applies all defaults correctly
- [ ] `defineConfig()` rejects missing `database`
- [ ] `defineConfig()` rejects invalid types for all fields
- [ ] `defineConfig()` preserves explicitly set values (doesn't override with defaults)
- [ ] `resolveConfig()` merges file config with env overrides in correct order
- [ ] `mapPgType()` correctly maps all supported PostgreSQL types
- [ ] `mapPgType()` returns 'unknown' for unrecognized types
- [ ] `ProviderRegistry.register()` stores provider
- [ ] `ProviderRegistry.get()` retrieves registered provider
- [ ] `ProviderRegistry.get()` throws for unregistered type
- [ ] `ProviderRegistry.initAll()` calls init on all providers
- [ ] `ProviderRegistry.shutdownAll()` calls shutdown on all providers
- [ ] `PluginManager.runHook()` executes hooks in order
- [ ] `PluginManager.runHook()` chains `onSchemaLoaded` transformations
- [ ] `PluginManager.runHook()` skips plugins that don't implement the hook
- [ ] Error classes include correct codes
- [ ] Data hooks execute in correct order (validate → before → after)
- [ ] `beforeInsert` hook can modify data
- [ ] `beforeInsert` hook can abort with ValidationError
- [ ] `afterInsert` hook failure does not roll back the insert
- [ ] `validate` hook runs for both insert and update
- [ ] `beforeUpdate` hook receives existing row in `ctx.existing`
- [ ] No hooks configured → operation passes through unmodified
- [ ] Action condition returns true → action included in `_actions`
- [ ] Action condition returns false → action excluded from `_actions`
- [ ] Action with no condition → always included in `_actions`
- [ ] Action execution re-checks condition before running handler
- [ ] Action with `roles` → excluded for users without matching role
- [ ] Action with `bulk: true` → handler receives multiple rows
- [ ] Action handler result controls UI response (message, refresh, redirect)

### Integration Tests
- [ ] `loadConfig()` loads from a real TypeScript config file
- [ ] `loadConfig()` merges env vars with file config

## File Manifest

```
packages/core/
  src/
    index.ts                    # Public API re-exports
    config/
      types.ts                  # ProjectConfig and related interfaces
      schema.ts                 # Zod schema + defineConfig()
      loader.ts                 # File + env config loading
      defaults.ts               # Default values constant
    metadata/
      types.ts                  # TableMeta, ColumnMeta, etc.
      column-types.ts           # mapPgType() + ColumnType enum
    providers/
      types.ts                  # Provider interfaces
      registry.ts               # ProviderRegistry class
    plugins/
      types.ts                  # Plugin interface
      manager.ts                # PluginManager class
    hooks/
      types.ts                  # TableHooks, HookContext interfaces
      runner.ts                 # Hook execution engine (ordering, error handling)
    actions/
      types.ts                  # TableAction, ActionContext, ActionResult interfaces
      executor.ts               # Action condition evaluation + handler execution
    errors.ts                   # ConfigError, ProviderError, PluginError, ValidationError, HookError, ActionError
  tests/
    config.test.ts              # Config validation + defaults
    column-types.test.ts        # PG type mapping
    registry.test.ts            # Provider registry
    plugins.test.ts             # Plugin manager
    hooks.test.ts               # Data hook execution + ordering
  package.json
  tsconfig.json
```

## Decision References

- ADR-006: Provider Pattern — interface in core, default implementation in dedicated package
