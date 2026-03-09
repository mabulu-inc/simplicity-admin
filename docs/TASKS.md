# Task List

## Task Selection Algorithm

1. Read `PROGRESS.md` → "Current State" → "Next eligible task"
2. In this file, find that task and verify all `Depends` are DONE in PROGRESS.md
3. If verified, start that task
4. If stale: scan all tasks, filter to `TODO`, exclude tasks with unmet `Depends`, pick **lowest-numbered**

## Task Completion Criteria

A task is DONE when ALL three conditions hold:
1. All files listed in `Produces` exist
2. All tests listed in `Tests` pass
3. Full test suite (`pnpm test`) passes — no regressions

## Commit Convention

One commit per task: `T-NNN: short description`

## Blocked Tasks

If a task cannot be completed:
1. Set status to `BLOCKED` in PROGRESS.md with reason
2. Move to next eligible task
3. If no eligible tasks remain, halt and append `BLOCKED_ALL` entry

---

## M1: Foundation

### T-001: Initialize monorepo structure
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: US-001
- **Depends**: none
- **Produces**:
  - `package.json` (root workspace config, private: true)
  - `pnpm-workspace.yaml` (packages/*)
  - `turbo.json` (dev, build, test, lint, typecheck, clean tasks)
  - `tsconfig.base.json` (strict mode, ES2022, paths)
  - `eslint.config.js`
  - `vitest.config.ts` (shared config)
  - `.gitignore`
  - `.env.example`
  - `compose.yaml` (PostgreSQL 16 for dev/test)
  - `packages/core/package.json` (@simplicity-admin/core)
  - `packages/core/tsconfig.json`
  - `packages/core/src/index.ts` (empty re-export)
- **Tests**: `packages/core/tests/smoke.test.ts` — import `@simplicity-admin/core` resolves
- **AC**:
  - `pnpm install` succeeds
  - `pnpm build` succeeds (or no-ops)
  - `pnpm test` passes with 1 smoke test

### T-002: Core error classes
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-001
- **Produces**:
  - `packages/core/src/errors.ts` (ConfigError, ProviderError, PluginError with codes)
- **Tests**: `packages/core/tests/errors.test.ts` — each error class has correct name, code, message; extends Error; instanceof works
- **AC**: All error classes exported from `@simplicity-admin/core`

### T-003: Core config types + Zod schema
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-002
- **Produces**:
  - `packages/core/src/config/types.ts` (ProjectConfig, APIConfig, AuthConfig, TenancyConfig)
  - `packages/core/src/config/defaults.ts` (DEFAULT_CONFIG constant)
  - `packages/core/src/config/schema.ts` (Zod schema + `defineConfig()`)
- **Tests**: `packages/core/tests/config.test.ts`
  - `defineConfig({ database: '...' })` returns full config with defaults
  - Rejects missing `database`
  - Rejects invalid types (port as string, etc.)
  - Preserves explicitly set values over defaults
  - All defaults match spec (port 3000, basePath '/admin', etc.)
- **AC**: `defineConfig()` and `ProjectConfig` type exported from `@simplicity-admin/core`

### T-004: Core config loader
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-003
- **Produces**:
  - `packages/core/src/config/loader.ts` (`loadConfig()`, `resolveConfig()`)
- **Tests**: `packages/core/tests/config-loader.test.ts`
  - Loads config from a TypeScript file
  - Merges env vars (e.g., `SIMPLICITY_ADMIN_PORT=4000` overrides file)
  - Resolution order: defaults < file < env
  - Throws ConfigError for missing file with helpful message
- **AC**: `loadConfig(path?)` exported from `@simplicity-admin/core`

### T-005: Core metadata types + column type mapping
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-001
- **Produces**:
  - `packages/core/src/metadata/types.ts` (TableMeta, ColumnMeta, RelationMeta, EnumMeta, SchemaMeta)
  - `packages/core/src/metadata/column-types.ts` (ColumnType enum, `mapPgType()`)
- **Tests**: `packages/core/tests/column-types.test.ts`
  - Maps all common PG types (integer, text, boolean, uuid, timestamptz, jsonb, numeric, varchar, etc.)
  - Returns 'unknown' for unrecognized types
  - Handles `character varying` → varchar, `timestamp with time zone` → timestamptz, etc.
- **AC**: All metadata types and `mapPgType()` exported from `@simplicity-admin/core`

### T-006: Core provider interfaces + registry
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-002
- **Produces**:
  - `packages/core/src/providers/types.ts` (Provider, DatabaseProvider, APIProvider, AuthProvider, UIProvider, ConnectionPool, etc.)
  - `packages/core/src/providers/registry.ts` (ProviderRegistry class, `createRegistry()`)
- **Tests**: `packages/core/tests/registry.test.ts`
  - `register()` stores provider, `get()` retrieves it
  - `get()` throws ProviderError for unregistered type
  - `has()` returns boolean
  - `initAll()` calls `init()` on all providers
  - `shutdownAll()` calls `shutdown()` on all providers
  - Skips providers without init/shutdown methods
- **AC**: All provider interfaces and `ProviderRegistry` exported

### T-007: Core plugin types + manager
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-005, T-006
- **Produces**:
  - `packages/core/src/plugins/types.ts` (Plugin, AppContext, RequestContext)
  - `packages/core/src/plugins/manager.ts` (PluginManager class)
- **Tests**: `packages/core/tests/plugins.test.ts`
  - Hooks execute in registration order
  - `onSchemaLoaded` chains transformations (A transforms, B receives A's output)
  - Skips plugins that don't implement a hook
  - Throws PluginError wrapping original error
- **AC**: `PluginManager` and plugin types exported

### T-008: Core index — re-export all public API
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/core.md
- **Story**: —
- **Depends**: T-003, T-004, T-005, T-006, T-007
- **Produces**:
  - `packages/core/src/index.ts` (re-exports everything)
- **Tests**: `packages/core/tests/exports.test.ts`
  - All public types and functions importable from `@simplicity-admin/core`
  - `defineConfig`, `loadConfig`, `mapPgType`, `ProviderRegistry`, `PluginManager` all resolve
- **AC**: Single import path works: `import { defineConfig, mapPgType, ProviderRegistry } from '@simplicity-admin/core'`

### T-009: Initialize @simplicity-admin/db package
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-001
- **Produces**:
  - `packages/db/package.json`
  - `packages/db/tsconfig.json`
  - `packages/db/src/index.ts` (empty)
- **Tests**: `packages/db/tests/smoke.test.ts` — import resolves
- **AC**: Package builds and imports

### T-010: DB connection manager
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-009, T-006
- **Produces**:
  - `packages/db/src/connection.ts` (`createPool()`)
- **Tests**: `packages/db/tests/connection.test.ts` (integration — real Postgres)
  - Connects and executes `SELECT 1`
  - `withClient()` provides a client that can query
  - `pool.end()` cleans up
  - Bad URL throws DatabaseError with masked password
- **AC**: `createPool(url)` returns working `ConnectionPool`

### T-011: DB introspection — list tables
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-010, T-005
- **Produces**:
  - `packages/db/src/introspect/tables.ts` (`listTables()`)
- **Tests**: `packages/db/tests/introspect.test.ts` (integration)
  - Returns table names from test schema
  - Excludes pg_* and information_schema tables
  - Respects schema filter
  - Includes table comments
- **AC**: `listTables(pool, schema?)` returns `TableMeta[]`

### T-012: DB introspection — columns
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-011
- **Produces**:
  - `packages/db/src/introspect/columns.ts` (`introspectColumns()`)
- **Tests**: `packages/db/tests/introspect-columns.test.ts` (integration)
  - Returns correct type, nullable, hasDefault, isPrimaryKey for each column
  - Detects enum columns with values
  - Detects generated columns
  - Handles varchar(N) maxLength
  - Handles numeric(P,S) precision/scale
- **AC**: `introspectColumns(pool, tableName, schema?)` returns `ColumnMeta[]`

### T-013: DB introspection — relations
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-011
- **Produces**:
  - `packages/db/src/introspect/relations.ts` (`introspectRelations()`)
- **Tests**: `packages/db/tests/introspect-relations.test.ts` (integration)
  - Detects FK constraints
  - Produces both many-to-one and one-to-many directions
  - Handles self-referencing FKs
  - Includes constraint name
- **AC**: `introspectRelations(pool, schema?)` returns `RelationMeta[]`

### T-014: DB introspection — enums
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-011
- **Produces**:
  - `packages/db/src/introspect/enums.ts` (`introspectEnums()`)
- **Tests**: `packages/db/tests/introspect-enums.test.ts` (integration)
  - Discovers enum types
  - Returns values in defined order
  - Includes schema qualification
- **AC**: `introspectEnums(pool, schema?)` returns `EnumMeta[]`

### T-015: DB introspection — full schema assembly
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-012, T-013, T-014
- **Produces**:
  - `packages/db/src/introspect/index.ts` (`introspectSchema()` orchestrator)
- **Tests**: `packages/db/tests/introspect-full.test.ts` (integration)
  - Multi-table test schema produces complete SchemaMeta
  - Tables have columns populated
  - Relations are linked correctly
  - Enums are included
- **AC**: `introspectSchema(pool, schema?)` returns complete `SchemaMeta`

### T-016: System schema YAML (schema-flow)
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md, docs/specs/tenancy.md
- **Story**: US-002
- **Depends**: T-009
- **Produces**:
  - `packages/db/schema/tables/users.yaml`
  - `packages/db/schema/tables/tenants.yaml`
  - `packages/db/schema/tables/memberships.yaml`
  - `packages/db/schema/roles/authenticator.yaml`
  - `packages/db/schema/roles/anon.yaml`
  - `packages/db/schema/roles/app_viewer.yaml`
  - `packages/db/schema/roles/app_editor.yaml`
  - `packages/db/schema/roles/app_admin.yaml`
  - `packages/db/schema/functions/current_user_id.yaml`
  - `packages/db/schema/functions/current_tenant_id.yaml`
  - `packages/db/schema/functions/begin_session.yaml`
  - `packages/db/schema/mixins/timestamps.yaml`
  - `packages/db/schema/mixins/tenant_scoped.yaml`
  - `packages/db/schema/mixins/auditable.yaml`
- **Tests**: `packages/db/tests/schema-validation.test.ts` (integration)
  - `schema-flow validate` passes against an empty DB
  - YAML files parse correctly
- **AC**: All system schema YAML files are valid schema-flow definitions

### T-017: DB bootstrap orchestrator
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: US-002
- **Depends**: T-016, T-010
- **Produces**:
  - `packages/db/src/bootstrap.ts` (`bootstrap()`)
- **Tests**: `packages/db/tests/bootstrap.test.ts` (integration)
  - Creates system schema on fresh DB (schema-flow run)
  - Creates default tenant
  - Creates default admin user (admin@localhost / changeme)
  - Idempotent — running twice is safe
- **AC**: `bootstrap(pool, config)` creates all system objects

### T-018: DB provider (default DatabaseProvider)
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/db.md
- **Story**: —
- **Depends**: T-015, T-017
- **Produces**:
  - `packages/db/src/provider.ts` (`postgresProvider()`)
  - `packages/db/src/index.ts` (re-exports)
- **Tests**: `packages/db/tests/provider.test.ts` (integration)
  - Provider implements DatabaseProvider interface
  - `connect()` returns pool
  - `introspect()` returns SchemaMeta
  - `migrate()` runs schema-flow
- **AC**: `postgresProvider()` exported from `@simplicity-admin/db`

### T-019: Initialize @simplicity-admin/auth package
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: US-003
- **Depends**: T-001
- **Produces**:
  - `packages/auth/package.json`
  - `packages/auth/tsconfig.json`
  - `packages/auth/src/index.ts` (empty)
- **Tests**: `packages/auth/tests/smoke.test.ts`
- **AC**: Package builds

### T-020: Password utilities
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: US-003
- **Depends**: T-019
- **Produces**:
  - `packages/auth/src/password.ts` (`hashPassword()`, `verifyPassword()`)
- **Tests**: `packages/auth/tests/password.test.ts`
  - Hash produces bcrypt string (starts with $2b$)
  - Verify correct password returns true
  - Verify wrong password returns false
  - Cost factor is 12+
- **AC**: Password utilities exported from `@simplicity-admin/auth`

### T-021: JWT provider
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: US-003
- **Depends**: T-019, T-006
- **Produces**:
  - `packages/auth/src/providers/jwt.ts` (`jwtProvider()`)
- **Tests**: `packages/auth/tests/jwt.test.ts`
  - `sign()` produces valid JWT
  - `verify()` returns correct payload
  - `verify()` throws AuthError for expired token
  - `verify()` throws AuthError for invalid signature
  - `refresh()` returns new token pair
  - `refresh()` throws for expired refresh token
- **AC**: `jwtProvider()` implements `AuthProvider` interface

### T-022: Auth middleware
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: US-003
- **Depends**: T-021
- **Produces**:
  - `packages/auth/src/middleware.ts` (`createAuthMiddleware()`)
  - `packages/auth/src/context.ts` (AuthenticatedRequest type, `getUserFromRequest()`)
- **Tests**: `packages/auth/tests/middleware.test.ts`
  - Valid token → req.user populated, next() called
  - Missing token → req.user undefined, next() called (public route support)
  - Invalid token → 401 response
- **AC**: Auth middleware exported from `@simplicity-admin/auth`

### T-023: Login/logout/refresh routes
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: US-003
- **Depends**: T-022, T-020, T-017
- **Produces**:
  - `packages/auth/src/routes/login.ts`
  - `packages/auth/src/routes/logout.ts`
  - `packages/auth/src/routes/refresh.ts`
- **Tests**: `packages/auth/tests/auth-routes.test.ts` (integration)
  - Valid login returns token pair (200)
  - Invalid email returns 401 (same message as wrong password)
  - Invalid password returns 401
  - JWT payload includes userId, role, tenantId
  - Logout invalidates refresh token
  - Refresh with valid token returns new pair
  - Refresh with invalidated token returns 401
  - Default admin can log in after bootstrap
- **AC**: Auth routes handle complete login lifecycle

### T-024: Auth index — re-export all public API
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/auth.md
- **Story**: —
- **Depends**: T-021, T-022, T-023
- **Produces**:
  - `packages/auth/src/index.ts` (re-exports)
- **Tests**: `packages/auth/tests/exports.test.ts`
  - All public functions importable from `@simplicity-admin/auth`
- **AC**: Single import path works

### T-025: Initialize @simplicity-admin/api package
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/api.md
- **Story**: US-006
- **Depends**: T-001
- **Produces**:
  - `packages/api/package.json`
  - `packages/api/tsconfig.json`
  - `packages/api/src/index.ts` (empty)
- **Tests**: `packages/api/tests/smoke.test.ts`
- **AC**: Package builds

### T-026: pgSettings mapper
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/api.md
- **Story**: US-006
- **Depends**: T-025
- **Produces**:
  - `packages/api/src/graphql/pg-settings.ts` (`createPgSettingsFromToken()`)
- **Tests**: `packages/api/tests/pg-settings.test.ts`
  - Maps userId + role + tenantId to correct pgSettings keys
  - Omits tenant when not present
- **AC**: pgSettings mapper exported

### T-027: PostGraphile preset
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/api.md
- **Story**: US-006
- **Depends**: T-026, T-010
- **Produces**:
  - `packages/api/src/graphql/preset.ts` (`createPreset()`)
- **Tests**: `packages/api/tests/preset.test.ts` (integration)
  - Creates valid PostGraphile V5 preset
  - Preset includes pgSettings integration
  - Preset targets correct schema
- **AC**: `createPreset(config, pool)` returns valid GraphileConfig.Preset

### T-028: API server
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/api.md
- **Story**: US-006
- **Depends**: T-027, T-022
- **Produces**:
  - `packages/api/src/server.ts` (`createAPIServer()`)
  - `packages/api/src/provider.ts` (`postgraphileProvider()`)
  - `packages/api/src/index.ts` (re-exports)
- **Tests**: `packages/api/tests/server.test.ts` (integration)
  - POST to /api/graphql executes query and returns results
  - GraphQL CRUD operations work (query, create, update, delete)
  - Auth middleware is integrated (pgSettings set from JWT)
  - GraphiQL serves in dev mode
- **AC**: Full GraphQL API server works end-to-end

### T-029: Initialize @simplicity-admin/ui package
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-004, US-005
- **Depends**: T-001
- **Produces**:
  - `packages/ui/package.json`
  - `packages/ui/svelte.config.js`
  - `packages/ui/vite.config.ts`
  - `packages/ui/tsconfig.json`
  - `packages/ui/src/lib/index.ts` (empty)
- **Tests**: `packages/ui/tests/smoke.test.ts` — package builds
- **AC**: SvelteKit library package initializes

### T-030: Design tokens + theming
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: —
- **Depends**: T-029
- **Produces**:
  - `packages/ui/src/lib/tokens/types.ts`
  - `packages/ui/src/lib/tokens/primitives.ts`
  - `packages/ui/src/lib/tokens/semantic.ts`
  - `packages/ui/src/lib/themes/index.ts`
  - `packages/ui/src/lib/themes/light.css`
  - `packages/ui/src/lib/themes/dark.css`
- **Tests**: `packages/ui/tests/tokens/themes.test.ts`
  - Light and dark themes define all required tokens
  - `applyTheme()` sets CSS custom properties
- **AC**: Theme system works with light/dark themes

### T-031: Field type mapping
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-005
- **Depends**: T-029, T-005
- **Produces**:
  - `packages/ui/src/lib/components/field-map.ts` (`getFieldComponent()`, `getDisplayFormatter()`)
- **Tests**: `packages/ui/tests/field-map.test.ts`
  - Maps all ColumnTypes to correct field components
  - text/varchar → TextInput, integer → NumberInput, boolean → Toggle, enum → Select, uuid (FK) → RelationPicker, etc.
  - `getDisplayFormatter()` formats booleans (checkmark), dates (locale string), nulls ("—"), enums (title case)
- **AC**: Field mapping functions exported

### T-032: DataTable component
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-004
- **Depends**: T-030, T-031
- **Produces**:
  - `packages/ui/src/lib/components/DataTable.svelte`
- **Tests**: `packages/ui/tests/components/data-table.test.ts`
  - Renders column headers from ColumnMeta[]
  - Renders rows with formatted values
  - Sort click dispatches event with column + direction
  - Pagination renders correct info ("1-25 of 50")
  - Empty state shows "No records found"
  - Boolean columns show checkmark/x
  - Date columns show formatted dates
- **AC**: DataTable component renders metadata-driven tables

### T-033: Form field components
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-005
- **Depends**: T-030
- **Produces**:
  - `packages/ui/src/lib/components/fields/TextInput.svelte`
  - `packages/ui/src/lib/components/fields/NumberInput.svelte`
  - `packages/ui/src/lib/components/fields/Toggle.svelte`
  - `packages/ui/src/lib/components/fields/Select.svelte`
  - `packages/ui/src/lib/components/fields/DatePicker.svelte`
  - `packages/ui/src/lib/components/fields/DateTimePicker.svelte`
  - `packages/ui/src/lib/components/fields/RelationPicker.svelte`
  - `packages/ui/src/lib/components/fields/JSONEditor.svelte`
  - `packages/ui/src/lib/components/fields/TagInput.svelte`
  - `packages/ui/src/lib/components/fields/TextArea.svelte`
- **Tests**: `packages/ui/tests/components/fields.test.ts`
  - Each field component renders
  - Each field component binds value correctly
  - Required validation works on each
- **AC**: All form field components render and bind values

### T-034: AutoForm component
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-005
- **Depends**: T-031, T-033
- **Produces**:
  - `packages/ui/src/lib/components/AutoForm.svelte`
  - `packages/ui/src/lib/components/ConfirmDialog.svelte`
  - `packages/ui/src/lib/components/Toast.svelte`
- **Tests**: `packages/ui/tests/components/auto-form.test.ts`
  - Generates correct field types from ColumnMeta[]
  - Populates values in edit mode
  - Validates required fields (nullable: false, hasDefault: false)
  - Hides PK and generated columns in create mode
  - Respects readOnlyColumns (renders but disables)
  - Submit dispatches onSubmit with form data
  - Delete button shows confirmation dialog
- **AC**: AutoForm generates create/edit forms from metadata

### T-035: Layout components (Shell, Sidebar, TopBar)
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/ui.md
- **Story**: US-004
- **Depends**: T-030
- **Produces**:
  - `packages/ui/src/lib/components/Shell.svelte`
  - `packages/ui/src/lib/components/Sidebar.svelte`
  - `packages/ui/src/lib/components/TopBar.svelte`
- **Tests**: `packages/ui/tests/components/layout.test.ts`
  - Shell renders sidebar + content area
  - Sidebar renders navigation items
  - Sidebar highlights active item
  - TopBar renders user info
  - TopBar shows tenant switcher when tenants provided
  - TopBar hides tenant switcher when omitted
- **AC**: Layout components render admin shell

### T-036: GraphQL query builder
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/crud.md
- **Story**: US-004, US-005
- **Depends**: T-005
- **Produces**:
  - `packages/ui/src/lib/graphql/query-builder.ts`
- **Tests**: `packages/ui/tests/crud/query-builder.test.ts`
  - `buildListQuery()` produces valid GraphQL with pagination args
  - `buildDetailQuery()` includes relation fields
  - `buildCreateMutation()` produces valid mutation
  - `buildUpdateMutation()` produces valid mutation
  - `buildDeleteMutation()` produces valid mutation
  - Handles tables with no relations
  - Respects column filtering (only requested columns)
- **AC**: GraphQL query builder generates correct queries/mutations for any table shape

### T-037: Admin app — SvelteKit entry point + auth gate
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/crud.md, docs/specs/auth.md
- **Story**: US-003, US-004
- **Depends**: T-035, T-028, T-022
- **Produces**:
  - `packages/ui/src/routes/+layout.svelte`
  - `packages/ui/src/routes/+layout.server.ts`
  - `packages/ui/src/routes/(auth)/login/+page.svelte`
  - `packages/ui/src/routes/(app)/+layout.svelte`
  - `packages/ui/src/routes/(app)/+layout.server.ts`
- **Tests**: `packages/ui/tests/e2e/auth-gate.spec.ts` (Playwright)
  - Unauthenticated user is redirected to login
  - Login page renders email/password form
  - Valid login redirects to admin home
  - Invalid login shows error message
  - Authenticated user sees admin shell
- **AC**: Admin UI boots with login gate and shell layout

### T-038: Admin app — dynamic list view
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/crud.md
- **Story**: US-004
- **Depends**: T-037, T-032, T-036
- **Produces**:
  - `packages/ui/src/routes/(app)/[table]/+page.svelte`
  - `packages/ui/src/routes/(app)/[table]/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/list-view.spec.ts` (Playwright)
  - Navigating to /admin/contacts shows DataTable
  - Column headers match schema
  - Pagination works
  - Sorting works
  - Empty table shows empty state
- **AC**: Any table gets an auto-generated list view

### T-039: Admin app — dynamic create/edit/delete views
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/crud.md
- **Story**: US-005
- **Depends**: T-038, T-034
- **Produces**:
  - `packages/ui/src/routes/(app)/[table]/new/+page.svelte`
  - `packages/ui/src/routes/(app)/[table]/new/+page.server.ts`
  - `packages/ui/src/routes/(app)/[table]/[id]/+page.svelte`
  - `packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/crud-views.spec.ts` (Playwright)
  - /contacts/new shows create form
  - Create form submits and creates record
  - /contacts/[id] shows edit form with values
  - Edit form submits partial update
  - Delete shows confirmation, then removes record
- **AC**: Full CRUD through auto-generated forms

### T-040: Initialize @simplicity-admin/cli package
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/cli.md
- **Story**: US-001, US-007
- **Depends**: T-001
- **Produces**:
  - `packages/cli/package.json` (bin entry for CLI)
  - `packages/cli/tsconfig.json`
  - `packages/cli/src/index.ts` (programmatic API: `createAdmin`, `startServer`)
  - `packages/cli/src/cli.ts` (CLI entry with arg parser)
- **Tests**: `packages/cli/tests/cli.test.ts`
  - `--help` outputs usage
  - `--version` outputs version
  - Unknown command shows error + help
- **AC**: CLI binary runs, help and version work

### T-041: CLI init command
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/cli.md
- **Story**: US-001
- **Depends**: T-040, T-016
- **Produces**:
  - `packages/cli/src/commands/init.ts`
  - `packages/cli/src/templates/` (package.json.tmpl, config.ts.tmpl, compose.yaml.tmpl, env.example.tmpl, gitignore.tmpl)
- **Tests**: `packages/cli/tests/init.test.ts` (integration)
  - Creates directory with expected files
  - Generated package.json has @simplicity-admin dependencies
  - Generated config has DATABASE_URL placeholder
  - Rejects non-empty directory
  - Works with `.` (current directory)
- **AC**: `npx simplicity-admin init my-admin` creates working starter project

### T-042: CLI dev command
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/cli.md
- **Story**: US-007
- **Depends**: T-040, T-028, T-017, T-037
- **Produces**:
  - `packages/cli/src/commands/dev.ts`
- **Tests**: `packages/cli/tests/dev.test.ts` (integration)
  - Starts and responds to health check
  - Bootstraps DB on first run
  - Prints startup banner with URLs
  - Fails gracefully if DB not available
  - Fails gracefully if no config file
- **AC**: `npx simplicity-admin dev` starts full dev environment

### T-043: CLI generate + migrate commands
- **Status**: DONE
- **Milestone**: M1
- **Spec**: docs/specs/cli.md
- **Story**: US-002
- **Depends**: T-040, T-018
- **Produces**:
  - `packages/cli/src/commands/generate.ts`
  - `packages/cli/src/commands/migrate.ts`
- **Tests**: `packages/cli/tests/generate.test.ts` (integration)
  - `generate` produces YAML files from test DB
  - `migrate` applies schema changes
- **AC**: Generate and migrate commands delegate to schema-flow

### T-044: M1 end-to-end smoke test
- **Status**: DONE
- **Milestone**: M1
- **Spec**: all M1 specs
- **Story**: all M1 stories
- **Depends**: T-039, T-042
- **Produces**:
  - `tests/e2e/m1-smoke.spec.ts`
- **Tests**: `tests/e2e/m1-smoke.spec.ts` (Playwright)
  - Start dev server → login with default admin → see auto-generated nav → navigate to table list → create record → edit record → delete record → logout
- **AC**: Full M1 user journey works end-to-end

---

## M2: Access Control

### T-045: RBAC permission types
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/rbac.md
- **Story**: US-008
- **Depends**: T-008
- **Produces**:
  - `packages/auth/src/rbac/types.ts`
- **Tests**: `packages/auth/tests/rbac/types.test.ts` — type smoke test
- **AC**: Permission types exported

### T-046: RBAC permission engine
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/rbac.md
- **Story**: US-008
- **Depends**: T-045, T-018
- **Produces**:
  - `packages/auth/src/rbac/engine.ts` (`getEffectivePermissions()`, `canAccess()`, `canAccessColumn()`, `getAccessibleColumns()`)
- **Tests**: `packages/auth/tests/rbac/engine.test.ts` (unit + integration)
  - `canAccess()` true for granted, false for non-granted
  - `canAccessColumn()` true for granted column, false for denied
  - `getAccessibleColumns()` returns correct columns per operation
  - `getEffectivePermissions()` reads grants from real DB
  - Column-level detail included
- **AC**: Permission engine reads and evaluates database grants

### T-047: RBAC UI overrides
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/rbac.md
- **Story**: US-009
- **Depends**: T-046
- **Produces**:
  - `packages/auth/src/rbac/overrides.ts` (`saveOverride()`, `removeOverride()`, `listOverrides()`)
  - System table YAML for permission overrides (add to schema/)
- **Tests**: `packages/auth/tests/rbac/overrides.test.ts` (integration)
  - Save deny override persists
  - Save override that exceeds code ceiling is rejected
  - Remove override restores code permission
  - Merged permissions (code + overrides) are correct
- **AC**: UI can restrict (never expand) permissions beyond code ceiling

### T-048: RBAC integration into CRUD views
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/rbac.md, docs/specs/crud.md
- **Story**: US-008
- **Depends**: T-046, T-038, T-039
- **Produces**:
  - Updates to `packages/ui/src/routes/(app)/[table]/+page.server.ts` (filter columns by permission)
  - Updates to `packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts` (readOnly columns)
- **Tests**: `packages/ui/tests/e2e/rbac-crud.spec.ts` (Playwright)
  - `app_viewer` cannot see denied columns in list view
  - `app_editor` sees read-only columns in edit form
  - `app_viewer` does not see create/delete buttons
- **AC**: CRUD views respect column-level RBAC

### T-049: Navigation builder
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/nav.md
- **Story**: US-010
- **Depends**: T-046, T-005
- **Produces**:
  - `packages/ui/src/lib/nav/types.ts`
  - `packages/ui/src/lib/nav/builder.ts` (`buildNavItems()`, `humanizeTableName()`)
- **Tests**: `packages/ui/tests/nav/builder.test.ts`
  - Auto-generates alphabetical nav from schema
  - Filters by RBAC permissions
  - Applies custom grouping, ordering, labels, icons
  - Excludes system schema tables
  - `humanizeTableName()` converts snake_case to Title Case
  - Custom role restrictions work
  - Non-table items (custom hrefs) included
- **AC**: Navigation builder produces role-filtered, customizable nav

### T-050: Role-based navigation integration
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/nav.md
- **Story**: US-010
- **Depends**: T-049, T-037
- **Produces**:
  - Updates to `packages/ui/src/routes/(app)/+layout.server.ts` (build nav from permissions)
  - Updates to Sidebar to use `buildNavItems()` output
- **Tests**: `packages/ui/tests/e2e/nav.spec.ts` (Playwright)
  - `app_admin` sees all tables in nav
  - `app_viewer` sees only permitted tables
  - Navigation groups render correctly
  - Active item is highlighted
- **AC**: Sidebar navigation adapts to user's role

### T-051: Permissions management UI
- **Status**: DONE
- **Milestone**: M2
- **Spec**: docs/specs/rbac.md
- **Story**: US-009
- **Depends**: T-047, T-037
- **Produces**:
  - `packages/ui/src/routes/(app)/settings/permissions/+page.svelte`
  - `packages/ui/src/routes/(app)/settings/permissions/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/permissions-ui.spec.ts` (Playwright)
  - Permissions matrix renders (roles × tables × operations)
  - Admin can toggle column permissions
  - Changes take effect immediately
- **AC**: Permission management UI allows admins to customize RBAC

### T-052: M2 end-to-end smoke test
- **Status**: DONE
- **Milestone**: M2
- **Spec**: all M2 specs
- **Story**: all M2 stories
- **Depends**: T-048, T-050, T-051
- **Produces**:
  - `tests/e2e/m2-smoke.spec.ts`
- **Tests**: Full M2 journey
  - Login as admin → see full nav → login as viewer → see restricted nav → viewer cannot see restricted columns → admin customizes permissions → viewer sees updated restrictions
- **AC**: Full M2 access control journey works

---

## M3: Intelligence

### T-053: Dashboard types + storage
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/dashboards.md
- **Story**: US-011
- **Depends**: T-018
- **Produces**:
  - `packages/ui/src/lib/dashboards/types.ts`
  - `packages/ui/src/lib/dashboards/manager.ts`
  - System table YAML for dashboards + widgets
- **Tests**: `packages/ui/tests/dashboards/manager.test.ts` (integration)
  - CRUD for dashboards
  - CRUD for widgets
  - `listDashboards()` filters by role
  - `getDefaultDashboard()` returns correct dashboard
- **AC**: Dashboard management persists to database

### T-054: Widget execution engine
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/dashboards.md
- **Story**: US-011
- **Depends**: T-053
- **Produces**:
  - `executeWidgetQuery()` in manager.ts
- **Tests**: `packages/ui/tests/dashboards/widgets.test.ts` (integration)
  - Stat query returns single value
  - Table query returns rows
  - Chart query returns label/value pairs
  - RLS enforced (tenant isolation)
  - Non-SELECT queries rejected
- **AC**: Widget queries execute safely with RLS

### T-055: Dashboard widget components
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/dashboards.md
- **Story**: US-011
- **Depends**: T-054, T-030
- **Produces**:
  - `packages/ui/src/lib/components/widgets/StatWidget.svelte`
  - `packages/ui/src/lib/components/widgets/TableWidget.svelte`
  - `packages/ui/src/lib/components/widgets/ChartWidget.svelte`
  - `packages/ui/src/lib/components/widgets/WidgetContainer.svelte`
  - `packages/ui/src/lib/components/DashboardGrid.svelte`
- **Tests**: `packages/ui/tests/components/widgets.test.ts`
  - StatWidget renders formatted number
  - TableWidget renders rows
  - ChartWidget renders (basic render test)
  - DashboardGrid arranges widgets by layout
- **AC**: Dashboard widget components render data

### T-056: Dashboard routes + builder UI
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/dashboards.md
- **Story**: US-011
- **Depends**: T-055, T-037
- **Produces**:
  - `packages/ui/src/routes/(app)/dashboard/+page.svelte`
  - `packages/ui/src/routes/(app)/dashboard/+page.server.ts`
  - `packages/ui/src/routes/(app)/dashboard/[slug]/+page.svelte`
  - `packages/ui/src/routes/(app)/dashboard/[slug]/+page.server.ts`
  - `packages/ui/src/lib/components/DashboardBuilder.svelte`
  - `packages/ui/src/routes/(app)/dashboard/builder/+page.svelte`
  - `packages/ui/src/routes/(app)/dashboard/builder/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/dashboards.spec.ts` (Playwright)
  - Default dashboard renders for role
  - Widgets display data
  - Dashboard builder creates new dashboard
- **AC**: Dashboards render and are configurable

### T-057: Notification types + engine
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/notifications.md
- **Story**: US-012
- **Depends**: T-008, T-018
- **Produces**:
  - `packages/core/src/notifications/types.ts`
  - `packages/core/src/notifications/engine.ts` (NotificationEngine)
  - `packages/core/src/notifications/rules.ts` (rule CRUD + condition evaluation)
  - System table YAML for notifications + rules
- **Tests**: `packages/core/tests/notifications/engine.test.ts` (unit + integration)
  - `evaluateCondition()` handles equality, inequality, gt, lt
  - Template interpolation replaces variables, handles missing (empty string)
  - `processEvent()` creates notification for matching rule
  - `processEvent()` skips non-matching conditions
  - `processEvent()` handles field.changed trigger
  - Disabled rules skipped
- **AC**: Notification engine processes events and creates notifications

### T-058: Notification delivery (in-app + email)
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/notifications.md
- **Story**: US-012
- **Depends**: T-057
- **Produces**:
  - `packages/core/src/notifications/email/types.ts`
  - `packages/core/src/notifications/email/provider.ts` (SMTP default)
  - `getUnread()`, `markRead()`, `markAllRead()` in engine.ts
- **Tests**: `packages/core/tests/notifications/delivery.test.ts` (integration)
  - In-app notification stored and retrievable
  - `getUnread()` returns correct notifications
  - `markRead()` updates status
  - `markAllRead()` marks all
  - Email provider sends (mock SMTP or test mode)
- **AC**: Notifications delivered via in-app and email channels

### T-059: Notification UI
- **Status**: DONE
- **Milestone**: M3
- **Spec**: docs/specs/notifications.md
- **Story**: US-012
- **Depends**: T-058, T-037
- **Produces**:
  - `packages/ui/src/lib/components/notifications/NotificationBell.svelte`
  - `packages/ui/src/lib/components/notifications/NotificationList.svelte`
  - `packages/ui/src/routes/(app)/notifications/+page.svelte`
  - `packages/ui/src/routes/(app)/notifications/+page.server.ts`
  - `packages/ui/src/routes/(app)/settings/notifications/+page.svelte`
  - `packages/ui/src/routes/(app)/settings/notifications/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/notifications.spec.ts` (Playwright)
  - Bell shows unread count
  - Notification list displays notifications
  - Mark as read works
  - Rule management UI works
- **AC**: Notification UI shows alerts and allows rule management

### T-060: M3 end-to-end smoke test
- **Status**: DONE
- **Milestone**: M3
- **Spec**: all M3 specs
- **Story**: all M3 stories
- **Depends**: T-056, T-059
- **Produces**:
  - `tests/e2e/m3-smoke.spec.ts`
- **Tests**: Dashboard renders widgets → create notification rule → trigger data event → notification appears in bell
- **AC**: Full M3 intelligence journey works

---

## M4: Automation

### T-061: Workflow types
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013, US-014
- **Depends**: T-008
- **Produces**:
  - `packages/core/src/workflow/types.ts` (StateMachine, Transition, Automation, etc.)
- **Tests**: type smoke test
- **AC**: Workflow types exported from core

### T-062: Workflow guard evaluation
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013
- **Depends**: T-061
- **Produces**:
  - `packages/core/src/workflow/guards.ts`
- **Tests**: `packages/core/tests/workflow/guards.test.ts`
  - Evaluates equality, inequality, gt, lt conditions
  - Returns true/false correctly
  - Handles missing fields gracefully
- **AC**: Guard evaluation works for all operators

### T-063: Workflow action executors
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013, US-014
- **Depends**: T-061, T-057
- **Produces**:
  - `packages/core/src/workflow/actions.ts` (notification, webhook, update_field, create_record)
- **Tests**: `packages/core/tests/workflow/actions.test.ts` (integration)
  - Notification action sends notification
  - Webhook action sends HTTP POST
  - Update field action modifies record
  - Create record action inserts record
  - Failed action logged but non-blocking
- **AC**: All action types execute correctly

### T-064: Workflow engine — state machines
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013
- **Depends**: T-062, T-063, T-018
- **Produces**:
  - `packages/core/src/workflow/engine.ts` (WorkflowEngine — state machine portion)
  - `packages/core/src/workflow/management.ts` (CRUD for state machines)
  - System table YAML for state machines + transition log
- **Tests**: `packages/core/tests/workflow/engine.test.ts` (integration)
  - `transition()` updates record state
  - `transition()` rejects unauthorized role
  - `transition()` rejects failed guard
  - `transition()` executes hooks
  - `transition()` creates audit log entry
  - `getAvailableTransitions()` filtered by role
  - Final state returns no transitions
  - `getTransitionHistory()` returns chronological log
- **AC**: State machine transitions work with guards, role checks, and hooks

### T-065: Workflow engine — event automations
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-014
- **Depends**: T-063, T-064
- **Produces**:
  - Event automation portion of engine.ts
  - `packages/core/src/workflow/management.ts` (CRUD for automations — extend)
  - System table YAML for automations + execution log
- **Tests**: `packages/core/tests/workflow/automations.test.ts` (integration)
  - `processEvent()` fires matching automations
  - Condition evaluation filters correctly
  - Disabled automations skipped
  - Loop detection stops at depth 10
  - Execution log records runs
- **AC**: Event-driven automations fire with conditions and actions

### T-066: Workflow UI — state badges + transition buttons
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013
- **Depends**: T-064, T-039
- **Produces**:
  - `packages/ui/src/lib/components/workflow/StateBadge.svelte`
  - `packages/ui/src/lib/components/workflow/TransitionButtons.svelte`
  - Updates to detail view to show state badge + transitions
- **Tests**: `packages/ui/tests/components/workflow.test.ts`
  - StateBadge renders with correct color and label
  - TransitionButtons shows available transitions
  - Clicking transition button triggers state change
- **AC**: Record detail view shows workflow state and transition actions

### T-067: Workflow management UI
- **Status**: DONE
- **Milestone**: M4
- **Spec**: docs/specs/workflow.md
- **Story**: US-013, US-014
- **Depends**: T-064, T-065, T-037
- **Produces**:
  - `packages/ui/src/routes/(app)/settings/workflow/+page.svelte`
  - `packages/ui/src/routes/(app)/settings/workflow/+page.server.ts`
  - `packages/ui/src/routes/(app)/settings/automations/+page.svelte`
  - `packages/ui/src/routes/(app)/settings/automations/+page.server.ts`
- **Tests**: `packages/ui/tests/e2e/workflow.spec.ts` (Playwright)
  - State machine management UI works
  - Automation management UI works
- **AC**: Workflow and automation management through admin UI

### T-068: M4 end-to-end smoke test
- **Status**: DONE
- **Milestone**: M4
- **Spec**: all M4 specs
- **Story**: all M4 stories
- **Depends**: T-066, T-067
- **Produces**:
  - `tests/e2e/m4-smoke.spec.ts`
- **Tests**: Define state machine on table → create record → transition states → verify audit log → create automation → trigger event → verify action executed
- **AC**: Full M4 automation journey works

---

## M5: Security Hardening

### T-069: Server-side RBAC enforcement on mutations
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-002)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts` — RBAC checks in `update`, `delete`, `transition` actions
  - Updated `packages/ui/src/routes/(app)/[table]/new/+page.server.ts` — RBAC check in `default` action
- **Tests**: `packages/ui/tests/security/rbac-mutations.test.ts`
  - POST to update action without permission returns 403
  - POST to delete action without permission returns 403
  - POST to create action without permission returns 403
  - POST to update action with read-only column is rejected
  - Unauthenticated POST returns 401
- **AC**: All mutation endpoints enforce RBAC server-side, not just via UI

### T-070: JWT secret validation and production guard
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-001)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/auth/src/providers/jwt.ts` — reject weak secrets in production
  - Updated `packages/core/src/config/schema.ts` — min length on auth.secret
  - Updated `packages/core/src/config/defaults.ts` — `graphiql: false` (B-SEC-008)
- **Tests**: `packages/auth/tests/jwt-secret-validation.test.ts`
  - Throws ConfigError when secret is 'development-secret' and NODE_ENV=production
  - Throws ConfigError when secret is shorter than 32 chars in production
  - Allows default secret in development (with warning)
  - GraphiQL defaults to false
- **AC**: Application refuses to start with weak secrets in production

### T-071: SQL identifier escaping utility
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-003)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - `packages/db/src/escape.ts` — `escapeIdentifier()` utility
  - Updated `packages/db/src/bootstrap.ts` — uses shared utility
  - Updated `packages/ui/src/routes/(app)/[table]/+page.server.ts` — uses shared utility
  - Updated `packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts` — uses shared utility
  - Updated `packages/ui/src/routes/(app)/[table]/new/+page.server.ts` — uses shared utility
- **Tests**: `packages/db/tests/escape.test.ts`
  - Escapes names containing double quotes
  - Escapes SQL reserved words
  - Handles unicode identifiers
  - Handles empty string edge case
- **AC**: All SQL identifier interpolation uses the shared utility

### T-072: Rate limiting on auth endpoints
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-004)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - `packages/auth/src/rate-limit.ts` — in-memory rate limiter
  - Updated `packages/auth/src/routes/login.ts` — rate limiting applied
  - Updated `packages/auth/src/routes/refresh.ts` — rate limiting applied
- **Tests**: `packages/auth/tests/rate-limit.test.ts`
  - Allows requests under the limit
  - Returns 429 after exceeding limit
  - Resets after window expires
  - Returns Retry-After header
- **AC**: Auth endpoints are rate-limited with configurable thresholds

### T-073: Request body size limiting
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-005)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/auth/src/routes/helpers.ts` — body size limit in `parseBody()`
- **Tests**: `packages/auth/tests/body-limit.test.ts`
  - Accepts bodies under 1 MB
  - Rejects bodies over 1 MB with 413 status
  - Configurable limit works
- **AC**: Auth endpoints reject oversized request bodies

### T-074: Error message sanitization
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-006)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - `packages/db/src/sanitize-error.ts` — `sanitizeDbError()` utility
  - Updated `packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts` — sanitized errors
  - Updated `packages/ui/src/routes/(app)/[table]/new/+page.server.ts` — sanitized errors
- **Tests**: `packages/db/tests/sanitize-error.test.ts`
  - Unique violation returns user-friendly message
  - FK violation returns user-friendly message
  - Unknown errors return generic message
  - Original error is not exposed to client
- **AC**: No raw database error messages are returned to the client

### T-075: Timing-safe login
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-009)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/auth/src/routes/login.ts` — dummy bcrypt on user-not-found
  - Updated `packages/ui/src/routes/api/auth/login/+server.ts` — dummy bcrypt on user-not-found
- **Tests**: `packages/auth/tests/timing-safe-login.test.ts`
  - Login with non-existent user takes similar time to wrong-password login
  - Both cases return identical 401 response
- **AC**: Login endpoint does not leak user existence via timing

### T-076: Token revocation persistence
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-007)
- **Story**: —
- **Depends**: T-071
- **Produces**:
  - Updated `packages/db/src/bootstrap.ts` — `revoked_tokens` table in system schema
  - Updated `packages/auth/src/routes/helpers.ts` — DB-backed revocation
  - `packages/auth/src/revocation.ts` — revocation store with SHA-256 hashing
- **Tests**: `packages/auth/tests/revocation.test.ts`
  - Revoked token is rejected after restart (DB-backed)
  - Token hash is stored, not raw token
  - Expired entries are cleaned up
- **AC**: Token revocation survives server restarts

### T-077: Refresh token rotation
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-010)
- **Story**: —
- **Depends**: T-076
- **Produces**:
  - Updated `packages/auth/src/routes/refresh.ts` — revoke old token on refresh
  - Updated `packages/auth/src/providers/jwt.ts` — support for user-level revocation
- **Tests**: `packages/auth/tests/token-rotation.test.ts`
  - Old refresh token is invalid after refresh
  - Reuse of revoked refresh token revokes all user tokens
- **AC**: Refresh tokens are single-use; reuse triggers security response

### T-078: Security headers
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-011)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/ui/src/hooks.server.ts` — security headers in response
- **Tests**: `packages/ui/tests/security/headers.test.ts`
  - Response includes X-Content-Type-Options: nosniff
  - Response includes X-Frame-Options: DENY
  - Response includes Referrer-Policy header
  - HSTS header present when NODE_ENV=production
- **AC**: All responses include standard security headers

### T-079: GraphQL depth limiting
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-012)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/api/src/graphql/preset.ts` — depth limiting plugin
  - Updated `packages/core/src/config/types.ts` — `api.maxQueryDepth` option
- **Tests**: `packages/api/tests/depth-limit.test.ts`
  - Query within depth limit succeeds
  - Query exceeding depth limit is rejected with error
  - Default depth limit is 10
- **AC**: Deeply nested GraphQL queries are rejected

### T-080: `begin_session` role validation
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md (B-SEC-013)
- **Story**: —
- **Depends**: T-068
- **Produces**:
  - Updated `packages/db/src/bootstrap.ts` — role whitelist in `begin_session` function
- **Tests**: `packages/db/tests/begin-session-validation.test.ts`
  - Known roles (anon, app_viewer, app_editor, app_admin) are accepted
  - Unknown roles raise an exception
  - EXECUTE grant is restricted to authenticator only
- **AC**: `begin_session` cannot be used for privilege escalation

### T-081: M5 security integration test
- **Status**: TODO
- **Milestone**: M5
- **Spec**: docs/specs/security.md
- **Story**: —
- **Depends**: T-069, T-070, T-071, T-072, T-073, T-074, T-075, T-076, T-077, T-078, T-079, T-080
- **Produces**:
  - `tests/e2e/m5-security.spec.ts`
- **Tests**: Full security journey — login with weak secret fails in prod mode → login rate limiting triggers → RBAC blocks unauthorized mutation → error messages are sanitized → security headers present → GraphQL depth limit enforced
- **AC**: All security hardening measures work together end-to-end

---

## Summary

| Milestone | Tasks | Range |
|-----------|-------|-------|
| M1: Foundation | 44 | T-001 — T-044 |
| M2: Access Control | 8 | T-045 — T-052 |
| M3: Intelligence | 8 | T-053 — T-060 |
| M4: Automation | 8 | T-061 — T-068 |
| M5: Security Hardening | 13 | T-069 — T-081 |
| **Total** | **81** | |
