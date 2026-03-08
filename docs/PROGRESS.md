# Progress Log

## Current State
<!-- Updated by each Ralph Loop iteration. Read this FIRST. -->
Last completed task: T-034
Next eligible task: T-035
Blockers: none
Test suite status: 413 passed

---

## Log

<!--
Each entry is APPEND-ONLY. Never edit previous entries.
Format for each entry:

### [ISO-8601 timestamp] — T-NNN: Task title
**Status**: DONE | BLOCKED | FAILED
**Commit**: <short hash>
**Duration**: ~N min
**Files created/modified**:
- path/to/file.ts
**Test results**: N passed, N failed
**Notes**: —
-->

### 2026-03-08 — T-001: Initialize monorepo structure
**Status**: DONE
**Commit**: 3bef93c
**Duration**: ~5 min
**Files created/modified**:
- package.json (root workspace config)
- pnpm-workspace.yaml
- turbo.json (dev, build, test, lint, typecheck, clean tasks)
- tsconfig.base.json (strict mode, ES2022)
- eslint.config.js
- vitest.config.ts (shared config)
- .gitignore
- .env.example
- compose.yaml (PostgreSQL 16)
- packages/core/package.json (@simplicity-admin/core)
- packages/core/tsconfig.json
- packages/core/vitest.config.ts
- packages/core/src/index.ts (empty re-export)
- packages/core/tests/smoke.test.ts
**Test results**: 1 passed, 0 failed
**Review**: Structure follows ARCHITECTURE.md module boundaries. Core has zero inter-package dependencies. Provider pattern foundation ready. No circular deps. All ACs met: pnpm install/build/test all succeed.
**Notes**: —

### 2026-03-08 — T-002: Core error classes
**Status**: DONE
**Commit**: 2fe548b
**Duration**: ~5 min
**Files created/modified**:
- packages/core/src/errors.ts (ConfigError, ProviderError, PluginError, ValidationError, HookError, ActionError)
- packages/core/src/index.ts (added error re-exports)
- packages/core/tests/errors.test.ts (22 tests)
- packages/core/vitest.config.ts (added resolve alias for @simplicity-admin/core)
**Test results**: 23 passed, 0 failed
**Review**: All 6 error classes match spec error table (CORE_001–CORE_012 codes). Each extends Error, has correct name property, supports error codes, and ProviderError/PluginError/HookError/ActionError support cause chaining. All exported from @simplicity-admin/core. instanceof works correctly across classes. No circular deps. vitest alias added so tests resolve package imports to source.
**Notes**: —

### 2026-03-08 — T-003: Core config types + Zod schema
**Status**: DONE
**Commit**: 246102b
**Duration**: ~8 min
**Files created/modified**:
- packages/core/src/config/types.ts (ProjectConfig, APIConfig, AuthConfig, AuthStrategyConfig, TenancyConfig, ProviderOverrides + forward-declared provider types)
- packages/core/src/config/defaults.ts (DEFAULT_CONFIG, DEFAULT_API, DEFAULT_AUTH, DEFAULT_TENANCY)
- packages/core/src/config/schema.ts (Zod v4 schema + defineConfig() with validation and defaults)
- packages/core/src/index.ts (added config type and function re-exports)
- packages/core/tests/config.test.ts (27 tests)
- packages/core/package.json (added zod dependency)
**Test results**: 50 passed, 0 failed
**Review**: All config types match spec interfaces. defineConfig() validates with Zod v4, applies all defaults per B-CORE-001/002/003/004/004b. Missing database → CORE_001 ConfigError, invalid types → CORE_002 ConfigError. Explicitly set values preserved over defaults. Forward-declared provider/plugin types use `type = object` (will be replaced by full interfaces in later tasks). No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-004: Core config loader
**Status**: DONE
**Commit**: cb225ef
**Duration**: ~5 min
**Files created/modified**:
- packages/core/src/config/loader.ts (loadConfig(), resolveConfig(), env var mapping)
- packages/core/tests/config-loader.test.ts (15 tests)
- packages/core/src/index.ts (added loadConfig, resolveConfig re-exports)
- packages/core/package.json (added @types/node devDependency)
- packages/core/tsconfig.json (added types: ["node"])
**Test results**: 65 passed, 0 failed
**Review**: loadConfig() loads TS/JS config files via dynamic import (B-CORE-005). resolveConfig() merges file config with env overrides using defaults < file < env resolution order (B-CORE-006). Missing file throws ConfigError with CORE_003 code and helpful message. Env var mapping covers DATABASE, SCHEMA, SYSTEM_SCHEMA, PORT, BASE_PATH, AUTH_SECRET with SIMPLICITY_ADMIN_ prefix. Config secrets never logged. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Added @types/node as devDependency since loader uses node:fs, node:path, node:url.

### 2026-03-08 — T-005: Core metadata types + column type mapping
**Status**: DONE
**Commit**: 8bd3ca3
**Duration**: ~4 min
**Files created/modified**:
- packages/core/src/metadata/types.ts (ColumnType, ColumnMeta, TableMeta, RelationMeta, EnumMeta, SchemaMeta)
- packages/core/src/metadata/column-types.ts (ColumnType type, PG_TYPE_MAP, mapPgType())
- packages/core/tests/column-types.test.ts (46 tests)
- packages/core/src/index.ts (added metadata type and function re-exports)
**Test results**: 111 passed, 0 failed
**Review**: All metadata interfaces match spec exactly (ColumnMeta, TableMeta, RelationMeta, EnumMeta, SchemaMeta). ColumnType is a union type covering all specified values. mapPgType() maps all common PG types including aliases (character varying→varchar, int4→integer, float8→double, bool→boolean, timestamp with time zone→timestamptz, etc.). Array types detected via "[]" suffix and "ARRAY" keyword. Unknown types return 'unknown' per B-CORE-014. All types and mapPgType exported from @simplicity-admin/core. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-006: Core provider interfaces + registry
**Status**: DONE
**Commit**: 2d64c55
**Duration**: ~5 min
**Files created/modified**:
- packages/core/src/providers/types.ts (Provider, DatabaseProvider, APIProvider, TokenProvider, AuthStrategy, AuthResult, TableHooks, HookContext, TableAction, ActionContext, ActionResult, UIProvider, HttpHandler, TokenPayload, TokenPair, ConnectionPool, QueryResult, PoolClient, MigrationConfig, MigrationResult)
- packages/core/src/providers/registry.ts (ProviderRegistry class, createRegistry())
- packages/core/tests/registry.test.ts (12 tests)
- packages/core/src/index.ts (added provider type and registry re-exports)
**Test results**: 123 passed, 0 failed
**Review**: All provider interfaces match spec exactly (Provider, DatabaseProvider, APIProvider, TokenProvider, AuthStrategy, UIProvider, ConnectionPool, etc.). ProviderRegistry implements register/get/has/initAll/shutdownAll per B-CORE-007/008/009. get() throws ProviderError with CORE_004 for unregistered types. initAll() wraps init failures in ProviderError with CORE_005 and cause chaining. initAll/shutdownAll skip providers without init/shutdown methods. createRegistry() returns new ProviderRegistry instance. All types and ProviderRegistry exported from @simplicity-admin/core. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-007: Core plugin types + manager
**Status**: DONE
**Commit**: 2931516
**Duration**: ~5 min
**Files created/modified**:
- packages/core/src/plugins/types.ts (Plugin, AppContext, RequestContext interfaces)
- packages/core/src/plugins/manager.ts (PluginManager class with runHook)
- packages/core/tests/plugins.test.ts (10 tests)
- packages/core/src/index.ts (added plugin type and PluginManager re-exports)
**Test results**: 133 passed, 0 failed
**Review**: All plugin interfaces match spec exactly (Plugin with 5 lifecycle hooks, AppContext, RequestContext). PluginManager.runHook() executes hooks in registration order (B-CORE-010). onSchemaLoaded chains transformations — each plugin receives previous plugin's output (B-CORE-011). Plugins without a given hook are silently skipped. Hook failures wrapped in PluginError with CORE_006 code, plugin name, hook name, and cause chaining. All types and PluginManager exported from @simplicity-admin/core. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-008: Core index — re-export all public API
**Status**: DONE
**Commit**: 6816519
**Duration**: ~3 min
**Files created/modified**:
- packages/core/tests/exports.test.ts (20 tests verifying all public API exports)
**Test results**: 153 passed, 0 failed
**Review**: All runtime exports verified (defineConfig, loadConfig, resolveConfig, DEFAULT_CONFIG, mapPgType, ProviderRegistry, createRegistry, PluginManager, all 6 error classes). Type exports verified compilable (ProjectConfig, SchemaMeta, Provider, Plugin, ColumnType). Single import path `import { ... } from '@simplicity-admin/core'` works for all exports. index.ts already had all re-exports from T-002–T-007. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-009: Initialize @simplicity-admin/db package
**Status**: DONE
**Commit**: df741c6
**Duration**: ~3 min
**Files created/modified**:
- packages/db/package.json (@simplicity-admin/db, depends on @simplicity-admin/core)
- packages/db/tsconfig.json
- packages/db/vitest.config.ts (aliases for @simplicity-admin/db and @simplicity-admin/core)
- packages/db/src/index.ts (empty re-export)
- packages/db/tests/smoke.test.ts (1 test)
**Test results**: 154 passed, 0 failed
**Review**: Package follows same structure as core. Depends on @simplicity-admin/core via workspace protocol. Build, typecheck, lint, test all pass. No circular deps. AC met: package builds and imports.
**Notes**: —

### 2026-03-08 — T-010: DB connection manager
**Status**: DONE
**Commit**: fe2b9f0
**Duration**: ~5 min
**Files created/modified**:
- packages/db/src/errors.ts (DatabaseError class + maskConnectionUrl helper)
- packages/db/src/connection.ts (createPool() returning ConnectionPool backed by pg.Pool)
- packages/db/src/index.ts (added createPool, DatabaseError, maskConnectionUrl re-exports)
- packages/db/tests/connection.test.ts (8 tests: connect+SELECT 1, withClient, pool.end cleanup, bad URL throws DatabaseError, maskConnectionUrl tests)
- packages/db/package.json (added pg, @types/pg dependencies)
**Test results**: 161 passed, 0 failed
**Review**: createPool() returns ConnectionPool interface backed by pg.Pool (B-DB-001). Lazy connection — first query triggers connect. Query failures wrapped in DatabaseError with DB_002 code. Connection failures wrapped with DB_001 code. Passwords masked in all error messages via maskConnectionUrl(). pool.end() cleanly closes connections (B-DB-003). withClient() acquires client, runs function, releases client. Idle pool errors handled silently. All integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Had to create simplicity_admin database — compose.yaml volume persisted old data with different DB name.

### 2026-03-08 — T-011: DB introspection — list tables
**Status**: DONE
**Commit**: f75e8eb
**Duration**: ~4 min
**Files created/modified**:
- packages/db/src/introspect/tables.ts (listTables() function)
- packages/db/tests/introspect.test.ts (8 integration tests)
- packages/db/src/index.ts (added listTables re-export)
**Test results**: 169 passed, 0 failed
**Review**: listTables() queries pg_catalog.pg_class for user tables (relkind='r') in the given schema, excluding pg_* tables (B-DB-004). Schema filter works correctly via parameterized query on pg_namespace (B-DB-005). Table comments retrieved via obj_description(). Returns TableMeta[] with name, schema, comment populated; columns and primaryKey left empty for introspectColumns to fill. Defaults to 'public' schema. Introspection failures wrapped in DatabaseError with DB_003 code. All 8 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-012: DB introspection — columns
**Status**: DONE
**Commit**: 0e1641c
**Duration**: ~5 min
**Files created/modified**:
- packages/db/src/introspect/columns.ts (introspectColumns() function)
- packages/db/tests/introspect-columns.test.ts (14 integration tests)
- packages/db/src/index.ts (added introspectColumns re-export)
**Test results**: 183 passed, 0 failed
**Review**: introspectColumns() queries information_schema.columns with pg_catalog joins for full column metadata (B-DB-006). Correctly maps all PG types via mapPgType() from core. Detects primary keys via pg_index (B-DB-006). Enum columns detected as USER-DEFINED type with values fetched from pg_enum in sort order (B-DB-007). Generated columns detected via is_generated='ALWAYS' (B-DB-008). varchar(N) maxLength, numeric(P,S) precision/scale all populated. Array columns detected with element type. Column comments via col_description(). Defaults to 'public' schema. Returns empty array for non-existent tables. Errors wrapped in DatabaseError with DB_003 code. All 14 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-013: DB introspection — relations
**Status**: DONE
**Commit**: 9980066
**Duration**: ~5 min
**Files created/modified**:
- packages/db/src/introspect/relations.ts (introspectRelations() function)
- packages/db/tests/introspect-relations.test.ts (8 integration tests)
- packages/db/src/index.ts (added introspectRelations re-export)
**Test results**: 191 passed, 0 failed
**Review**: introspectRelations() queries pg_catalog.pg_constraint for FK constraints (contype='f') in the given schema (B-DB-009). For each FK, produces both many-to-one (from FK table to referenced table) and one-to-many (reverse direction) per B-DB-010. Handles self-referencing FKs (categories.parent_id -> categories.id). Includes constraint name on all RelationMeta objects. Column names extracted via ARRAY subquery with attname::text cast for proper pg driver array parsing. Multiple FKs from same table handled correctly. Defaults to 'public' schema. Returns empty array for schemas with no FKs. Errors wrapped in DatabaseError with DB_003 code. All 8 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-014: DB introspection — enums
**Status**: DONE
**Commit**: 243b257
**Duration**: ~3 min
**Files created/modified**:
- packages/db/src/introspect/enums.ts (introspectEnums() function)
- packages/db/tests/introspect-enums.test.ts (6 integration tests)
- packages/db/src/index.ts (added introspectEnums re-export)
**Test results**: 197 passed, 0 failed
**Review**: introspectEnums() queries pg_catalog.pg_type for enum types (typtype='e') in the given schema (B-DB-011). Enum values fetched via pg_enum ordered by enumsortorder for correct defined order. Schema qualification included on all EnumMeta objects. Defaults to 'public' schema. Returns empty array for schemas with no enums. Errors wrapped in DatabaseError with DB_003 code. All 6 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-015: DB introspection — full schema assembly
**Status**: DONE
**Commit**: f568dc9
**Duration**: ~5 min
**Files created/modified**:
- packages/db/src/introspect/index.ts (introspectSchema() orchestrator)
- packages/db/tests/introspect-full.test.ts (8 integration tests)
- packages/db/src/index.ts (added introspectSchema re-export)
**Test results**: 205 passed, 0 failed
**Review**: introspectSchema() orchestrates listTables, introspectRelations, and introspectEnums in parallel, then populates columns on each table in parallel via introspectColumns (B-DB-012). Returns complete SchemaMeta with all tables (columns + primaryKey populated), all relations (both directions), and all enums. Defaults to 'public' schema. Handles empty schemas gracefully. Errors wrapped in DatabaseError with DB_003 code. All 8 integration tests use real Postgres with multi-table schema including composite PKs, FKs, and enums. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-016: System schema YAML (schema-flow)
**Status**: DONE
**Commit**: 6e8dd9c
**Duration**: ~8 min
**Files created/modified**:
- packages/db/schema/tables/users.yaml (id, email, password_hash, display_name, super_admin, active)
- packages/db/schema/tables/tenants.yaml (id, name, slug with format check)
- packages/db/schema/tables/memberships.yaml (id, user_id FK, tenant_id FK, role with validity check)
- packages/db/schema/roles/authenticator.yaml (login role, member of all app roles)
- packages/db/schema/roles/anon.yaml (unauthenticated, no login)
- packages/db/schema/roles/app_viewer.yaml (read-only)
- packages/db/schema/roles/app_editor.yaml (read+write)
- packages/db/schema/roles/app_admin.yaml (full access)
- packages/db/schema/functions/current_user_id.yaml (SQL, returns uuid from app.user_id)
- packages/db/schema/functions/current_tenant_id.yaml (SQL, returns uuid from app.tenant_id)
- packages/db/schema/functions/begin_session.yaml (PL/pgSQL, sets role + pgSettings)
- packages/db/schema/functions/update_timestamp.yaml (PL/pgSQL trigger, sets updated_at)
- packages/db/schema/mixins/timestamps.yaml (created_at, updated_at + update trigger)
- packages/db/schema/mixins/tenant_scoped.yaml (tenant_id FK + RLS policy with super-admin bypass)
- packages/db/schema/mixins/auditable.yaml (created_by, updated_by FK to users)
- packages/db/tests/schema-validation.test.ts (48 tests)
- packages/db/package.json (added yaml devDependency)
**Test results**: 253 passed, 0 failed
**Review**: All 14 schema-flow YAML files follow the documented YAML format reference. Tables: users has uuid PK, unique email, timestamps mixin; tenants has unique slug with regex check; memberships has composite unique index on (user_id, tenant_id, role) with FK constraints and role validity check. Roles: authenticator is login role with membership in all functional roles (anon, app_viewer, app_editor, app_admin) per ADR-005; functional roles are non-login with inherit. Functions: current_user_id/current_tenant_id return uuid from pgSettings; begin_session uses SECURITY DEFINER to SET LOCAL role and configure session variables; update_timestamp is the trigger function for timestamps mixin. Mixins: timestamps adds created_at/updated_at with auto-update trigger; tenant_scoped adds tenant_id with RLS policy matching B-TEN-011/018 (tenant isolation + super-admin bypass); auditable adds created_by/updated_by with FK to users. Grants on system tables restrict app_viewer/app_editor to SELECT on safe columns, app_admin gets full access. All 48 validation tests pass. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Also created update_timestamp.yaml function (referenced by timestamps mixin trigger) which is not in the Produces list but is required for the mixin to work.

### 2026-03-08 — T-017: DB bootstrap orchestrator
**Status**: DONE
**Commit**: 2d9630b
**Duration**: ~8 min
**Files created/modified**:
- packages/db/src/bootstrap.ts (bootstrap() orchestrator with roles, functions, tables, indexes, triggers, grants, seed data)
- packages/db/tests/bootstrap.test.ts (9 integration tests)
- packages/db/src/index.ts (added bootstrap re-export)
- packages/db/package.json (added bcrypt, @types/bcrypt dependencies)
**Test results**: 262 passed, 0 failed
**Review**: bootstrap() creates complete system schema per B-DB-013/014/015/016. Creates 5 database roles (authenticator with login + 4 functional roles) with correct membership grants. Creates 4 functions (current_user_id, current_tenant_id, begin_session with SECURITY DEFINER, update_timestamp trigger). Creates 3 system tables (users, tenants, memberships) with all columns, constraints, and CHECK constraints matching YAML definitions. Timestamps mixin applied via BEFORE UPDATE triggers with OLD IS DISTINCT FROM NEW guard. All table grants match YAML specs (app_viewer/app_editor get column-level SELECT, app_admin gets full CRUD). Seeds default tenant ('Default', slug: 'default') and admin user (admin@localhost, bcrypt-hashed 'changeme', super_admin: true) with app_admin membership. Idempotent via IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING. All 9 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Added bcrypt as devDependency for password hashing in seed data. Will be moved to regular dependency or shared with auth package when T-020 (password utils) is implemented.

### 2026-03-08 — T-018: DB provider (default DatabaseProvider)
**Status**: DONE
**Commit**: 6780c00
**Duration**: ~4 min
**Files created/modified**:
- packages/db/src/provider.ts (postgresProvider() factory returning DatabaseProvider)
- packages/db/src/index.ts (added postgresProvider re-export)
- packages/db/tests/provider.test.ts (6 integration tests)
**Test results**: 268 passed, 0 failed
**Review**: postgresProvider() returns a DatabaseProvider with name='postgres', version='0.0.1'. connect() wraps createPool() and verifies connectivity with a SELECT 1 query. introspect() delegates to introspectSchema(). migrate() delegates to bootstrap() for system schema setup (full schema-flow diff/apply to be added later). generate() is a no-op placeholder for B-DB-017 (schema-flow YAML generation from DB). All 4 DatabaseProvider methods implemented. Provider is stateless — each call to postgresProvider() creates a fresh instance. All 6 integration tests use real Postgres. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: migrate() currently wraps bootstrap() only. Full schema-flow migration (diff + apply) will be implemented when schema-flow engine is built.

### 2026-03-08 — T-019: Initialize @simplicity-admin/auth package
**Status**: DONE
**Commit**: fd61771
**Duration**: ~3 min
**Files created/modified**:
- packages/auth/package.json (@simplicity-admin/auth, depends on @simplicity-admin/core)
- packages/auth/tsconfig.json
- packages/auth/vitest.config.ts (aliases for @simplicity-admin/auth and @simplicity-admin/core)
- packages/auth/src/index.ts (empty re-export)
- packages/auth/tests/smoke.test.ts (1 test)
**Test results**: 269 passed, 0 failed
**Review**: Package follows same structure as core and db. Depends on @simplicity-admin/core via workspace protocol. Build, typecheck, lint, test all pass. No circular deps. AC met: package builds and imports.
**Notes**: —

### 2026-03-08 — T-020: Password utilities
**Status**: DONE
**Commit**: ab83ce0
**Duration**: ~3 min
**Files created/modified**:
- packages/auth/src/strategies/password.ts (hashPassword, verifyPassword with bcrypt cost 12)
- packages/auth/src/index.ts (added password utility re-exports)
- packages/auth/tests/password.test.ts (4 tests)
- packages/auth/package.json (added bcrypt, @types/bcrypt dependencies)
**Test results**: 273 passed, 0 failed
**Review**: hashPassword() uses bcrypt with SALT_ROUNDS=12 (≥12 per spec). Returns $2b$ prefixed hash (B-AUTH-007). verifyPassword() returns true for correct password (B-AUTH-008), false for wrong password (B-AUTH-009). Both functions exported from @simplicity-admin/auth. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-021: JWT token provider
**Status**: DONE
**Commit**: 70baaa6
**Duration**: ~5 min
**Files created/modified**:
- packages/auth/src/providers/jwt.ts (jwtTokenProvider() factory returning TokenProvider)
- packages/auth/src/errors.ts (AuthError class with code property)
- packages/auth/src/index.ts (added jwtTokenProvider, AuthError re-exports)
- packages/auth/tests/jwt.test.ts (6 tests)
- packages/auth/package.json (added jsonwebtoken, @types/jsonwebtoken dependencies)
**Test results**: 279 passed, 0 failed
**Review**: jwtTokenProvider() returns a TokenProvider with name='jwt', version='0.0.1'. sign() produces valid JWT with tokenType='access' claim (B-AUTH-001). verify() decodes and returns correct TokenPayload (B-AUTH-002). verify() throws AuthError with AUTH_002 for expired tokens (B-AUTH-003). verify() throws AuthError with AUTH_003 for invalid signatures (B-AUTH-004). refresh() returns new TokenPair with fresh access and refresh tokens using separate TTLs (B-AUTH-005). refresh() throws AuthError with AUTH_004 for expired refresh tokens (B-AUTH-006). Access and refresh tokens are distinguishable via tokenType claim. Default TTLs: 15 min access, 7 days refresh. AuthError class supports code and cause chaining. All exported from @simplicity-admin/auth. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-022: Auth middleware
**Status**: DONE
**Commit**: c9fe972
**Duration**: ~4 min
**Files created/modified**:
- packages/auth/src/middleware.ts (createAuthMiddleware(), HttpMiddleware type)
- packages/auth/src/context.ts (AuthenticatedRequest type, getUserFromRequest())
- packages/auth/src/index.ts (added middleware and context re-exports)
- packages/auth/tests/middleware.test.ts (6 tests)
**Test results**: 285 passed, 0 failed
**Review**: createAuthMiddleware() returns HttpMiddleware that extracts Bearer token from Authorization header. Valid token → decodes payload via tokenProvider.verify(), populates req.user with userId, tenantId, roles, activeRole, superAdmin, calls next() (B-AUTH-010). Missing token or non-Bearer auth → req.user undefined, next() called for public route support (B-AUTH-011). Invalid/expired token → 401 response with JSON { error: "Invalid token" } (B-AUTH-012). AuthenticatedRequest extends IncomingMessage with optional user property. getUserFromRequest() safely extracts user from any IncomingMessage. All exported from @simplicity-admin/auth. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-023: Login/logout/refresh routes
**Status**: DONE
**Commit**: 9917d6f
**Duration**: ~8 min
**Files created/modified**:
- packages/auth/src/routes/helpers.ts (parseBody, json, token revocation helpers)
- packages/auth/src/routes/login.ts (createLoginHandler — password strategy login with role/tenant resolution)
- packages/auth/src/routes/logout.ts (createLogoutHandler — token revocation)
- packages/auth/src/routes/refresh.ts (createRefreshHandler — token pair refresh with revocation check)
- packages/auth/tests/auth-routes.test.ts (8 integration tests)
- packages/auth/vitest.config.ts (added @simplicity-admin/db alias for integration tests)
**Test results**: 293 passed, 0 failed
**Review**: createLoginHandler() handles POST /auth/login with password strategy. Queries users table by email, verifies bcrypt password, fetches memberships for role/tenant resolution (B-AUTH-013/014/015/016). Returns same "Invalid credentials" error for missing email and wrong password — no email enumeration (B-AUTH-014/015). JWT payload includes userId, tenantId, roles, activeRole, authStrategy. Highest-privilege role is default activeRole (B-AUTH-016). Super-admin login sets superAdmin: true and defaults to app_admin role with first/default tenant (B-AUTH-027). createLogoutHandler() accepts refresh token and adds to in-memory revocation set (B-AUTH-017). createRefreshHandler() checks revocation set before refreshing token pair, returns 401 for revoked tokens (B-AUTH-018). Default admin (admin@localhost / changeme) can log in after bootstrap. All 8 integration tests use real Postgres with full bootstrap. No circular deps. Lint, typecheck, test all pass.
**Notes**: Token revocation uses in-memory Set — suitable for M1. Production would use Redis or a DB table.

### 2026-03-08 — T-024: Auth index — re-export all public API
**Status**: DONE
**Commit**: 130e327
**Duration**: ~3 min
**Files created/modified**:
- packages/auth/src/index.ts (added route handler re-exports)
- packages/auth/tests/exports.test.ts (8 tests)
**Test results**: 301 passed, 0 failed
**Review**: All public API functions importable from single `@simplicity-admin/auth` path: hashPassword, verifyPassword, jwtTokenProvider, AuthError, createAuthMiddleware, getUserFromRequest, createLoginHandler, createLogoutHandler, createRefreshHandler. HttpMiddleware and AuthenticatedRequest types also exported. All 8 export tests verify runtime availability via dynamic import. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-025: Initialize @simplicity-admin/api package
**Status**: DONE
**Commit**: 47e76fb
**Duration**: ~3 min
**Files created/modified**:
- packages/api/package.json (@simplicity-admin/api, depends on @simplicity-admin/core)
- packages/api/tsconfig.json
- packages/api/vitest.config.ts (aliases for @simplicity-admin/api and @simplicity-admin/core)
- packages/api/src/index.ts (empty re-export)
- packages/api/tests/smoke.test.ts (1 test)
**Test results**: 302 passed, 0 failed
**Review**: Package follows same structure as core, db, and auth. Depends on @simplicity-admin/core via workspace protocol. Build, typecheck, lint, test all pass. No circular deps. AC met: package builds and imports.
**Notes**: —

### 2026-03-08 — T-026: pgSettings mapper
**Status**: DONE
**Commit**: 12e1ee7
**Duration**: ~3 min
**Files created/modified**:
- packages/api/src/graphql/pg-settings.ts (createPgSettingsFromToken function)
- packages/api/tests/pg-settings.test.ts (2 tests)
- packages/api/src/index.ts (added export)
**Test results**: 304 passed, 0 failed
**Review**: createPgSettingsFromToken() maps TokenPayload to pgSettings per B-API-011/012. Sets `role` to activeRole, `app.user_id` to userId. Includes `app.tenant_id` only when tenantId is present (B-API-012). Exported from @simplicity-admin/api. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-027: PostGraphile preset
**Status**: DONE
**Commit**: 4c79798
**Duration**: ~5 min
**Files created/modified**:
- packages/api/src/graphql/preset.ts (createPreset() function)
- packages/api/src/index.ts (added createPreset re-export)
- packages/api/tests/preset.test.ts (5 tests)
- packages/api/package.json (updated postgraphile to V5 rc.5)
**Test results**: 306 passed, 0 failed
**Review**: createPreset() returns a valid PostGraphile V5 preset per B-API-001. Extends PostGraphileAmberPreset, configures pgServices with makePgService from @dataplan/pg/adaptors/pg targeting 'public' schema, and sets grafserv.graphiql from config. Updated postgraphile dependency from V4 (4.14.1) to V5 (5.0.0-rc.5) to match spec requirement. All 5 tests verify: preset has extends array, pgServices configuration, correct schema target, graphiql enabled/disabled. Exported from @simplicity-admin/api. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-028: API server
**Status**: DONE
**Commit**: 3be119f
**Duration**: ~10 min
**Files created/modified**:
- packages/api/src/server.ts (createAPIServer() with PostGraphile V5, grafserv, pgSettings from JWT)
- packages/api/src/provider.ts (postgraphileProvider() default APIProvider)
- packages/api/src/index.ts (added server and provider re-exports)
- packages/api/tests/server.test.ts (6 integration tests)
- packages/api/package.json (upgraded PostGraphile V5 packages to compatible rc versions)
- packages/api/vitest.config.ts (added @simplicity-admin/db alias)
- pnpm-lock.yaml (updated)
**Test results**: 320 passed, 0 failed
**Review**: createAPIServer() creates a full PostGraphile V5 GraphQL server per B-API-002. Uses postgraphile() + grafserv for Node.js HTTP handling. pgSettings are set from JWT payload via grafast context callback, mapping authenticated user to PostgreSQL role and session settings (B-API-011/012). GraphiQL enabled/disabled via config.api.graphiql (B-API-003). All 6 integration tests use real Postgres with a test schema containing a contacts table. Tests verify: GraphQL query returns data, create mutation works, list query returns created records, update mutation works (via updateContactByRowId in V5), delete mutation works (via deleteContactByRowId in V5), and GraphiQL serves HTML in dev mode. postgraphileProvider() wraps createAPIServer() as the default APIProvider with shutdown support. Fixed PostGraphile V5 package version incompatibility (grafast rc.7 → rc.8 to resolve markSyncAndSafe error). No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Upgraded PostGraphile V5 RC packages for version compatibility: postgraphile→rc.9, grafast→rc.8, @dataplan/pg→rc.7. PostGraphile V5 uses `updateContactByRowId`/`deleteContactByRowId` naming convention instead of V4's `updateContactById`.

### 2026-03-08 — T-029: Initialize @simplicity-admin/ui package
**Status**: DONE
**Commit**: e59689c
**Duration**: ~5 min
**Files created/modified**:
- packages/ui/package.json (@simplicity-admin/ui, Svelte 5, SvelteKit 2, Tailwind CSS v4)
- packages/ui/svelte.config.js (vitePreprocess)
- packages/ui/vite.config.ts (svelte plugin for dev/test)
- packages/ui/tsconfig.json (extends tsconfig.base.json)
- packages/ui/vitest.config.ts (aliases for @simplicity-admin/ui and @simplicity-admin/core)
- packages/ui/src/lib/index.ts (empty re-export)
- packages/ui/tests/smoke.test.ts (1 test)
- .gitignore (added .svelte-kit/)
**Test results**: 321 passed, 0 failed
**Review**: Package follows same structure as core/db/auth/api. Uses @sveltejs/package for library builds (svelte-package command). Depends on @simplicity-admin/core via workspace protocol. @sveltejs/vite-plugin-svelte v5 used for vite 6 compatibility. Build produces dist/ with JS and declaration files. .svelte-kit/ added to gitignore (generated directory). No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-030: Design tokens + theming
**Status**: DONE
**Commit**: 5bef2f7
**Duration**: ~5 min
**Files created/modified**:
- packages/ui/src/lib/tokens/types.ts (ThemeTokens interface with 30 token properties)
- packages/ui/src/lib/tokens/primitives.ts (raw color, spacing, typography, radius, shadow values)
- packages/ui/src/lib/tokens/semantic.ts (lightTokens, darkTokens mapping primitives to ThemeTokens)
- packages/ui/src/lib/themes/index.ts (lightTheme, darkTheme exports, applyTheme(), getSystemPreference())
- packages/ui/src/lib/themes/light.css (light theme CSS custom properties)
- packages/ui/src/lib/themes/dark.css (dark theme CSS custom properties)
- packages/ui/tests/tokens/themes.test.ts (9 tests)
- packages/ui/vitest.config.ts (added jsdom environment)
- packages/ui/package.json (added jsdom devDependency)
**Test results**: 330 passed, 0 failed
**Review**: ThemeTokens interface matches spec exactly with all 30 required properties (10 colors, 6 spacing, 6 typography, 3 radius, 2 shadows). lightTheme and darkTheme define all tokens — dark theme differs in color tokens (dark surface, light text) while sharing spacing/typography/radius/shadow values. applyTheme() converts camelCase keys to CSS custom properties (e.g. colorPrimary → --color-primary, space1 → --space-1) and sets them on document.documentElement (B-UI-023/024). getSystemPreference() uses window.matchMedia for prefers-color-scheme detection. CSS files provide static fallback for SSR. Primitives layer separates raw values from semantic mappings. All 9 tests pass including token completeness, theme application, overwrite behavior, and system preference. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Added jsdom as devDependency for DOM-based theme tests.

### 2026-03-08 — T-031: Field type mapping
**Status**: DONE
**Commit**: 7d09dc2
**Duration**: ~4 min
**Files created/modified**:
- packages/ui/src/lib/components/field-map.ts (getFieldComponent(), getDisplayFormatter(), FieldComponent type)
- packages/ui/src/lib/index.ts (added field-map re-exports)
- packages/ui/tests/field-map.test.ts (35 tests)
**Test results**: 360 passed, 0 failed
**Review**: getFieldComponent() maps all ColumnTypes to correct FieldComponent values per B-UI-025: text→TextArea, varchar/char→TextInput, all numeric types→NumberInput, boolean→Toggle, enum→Select, date→DatePicker, timestamp/timestamptz→DateTimePicker, json/jsonb→JSONEditor, array→TagInput, uuid with _id suffix (FK heuristic)→RelationPicker, uuid (plain)→TextInput, time/timetz→TextInput, unknown→TextInput (fallback per error handling spec). getDisplayFormatter() returns formatters: booleans→✓/✗ (B-UI-007), dates→locale string via toLocaleDateString (B-UI-008), enums→title case with underscore-to-space, nulls/undefined→em dash "—", all others→String(). Both functions exported from @simplicity-admin/ui. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-032: DataTable component
**Status**: DONE
**Commit**: 115bcf9
**Duration**: ~8 min
**Files created/modified**:
- packages/ui/src/lib/components/DataTable.svelte (metadata-driven table with sort, pagination, formatting)
- packages/ui/tests/components/data-table.test.ts (7 tests)
- packages/ui/vitest.config.ts (added svelte vite plugin + browser resolve conditions for component testing)
- packages/ui/package.json (added @testing-library/svelte, @testing-library/jest-dom devDependencies)
**Test results**: 367 passed, 0 failed
**Review**: DataTable renders column headers from ColumnMeta[] with humanized labels (B-UI-001). Rows render with values in correct columns (B-UI-002). Sort click dispatches onSort with column name and toggling asc/desc direction (B-UI-003). Pagination shows "N–M of T" format with Previous/Next buttons, Previous disabled on page 1 (B-UI-004). onRowClick fires with row data (B-UI-005). Empty state shows "No records found" within table tbody (B-UI-006). Boolean columns display ✓/✗ via getDisplayFormatter (B-UI-007). Date columns show formatted dates via toLocaleDateString (B-UI-008). Component uses Svelte 5 $props(), $state(), $derived(), $effect() runes. Testing setup uses @testing-library/svelte with @sveltejs/vite-plugin-svelte and browser resolve conditions to avoid SSR mount errors. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: Added @testing-library/svelte and @testing-library/jest-dom for Svelte component testing infrastructure, reusable by future component tests.

### 2026-03-08 — T-033: Form field components
**Status**: DONE
**Commit**: 0ecfeef
**Duration**: ~5 min
**Files created/modified**:
- packages/ui/src/lib/components/fields/TextInput.svelte
- packages/ui/src/lib/components/fields/NumberInput.svelte
- packages/ui/src/lib/components/fields/Toggle.svelte
- packages/ui/src/lib/components/fields/Select.svelte
- packages/ui/src/lib/components/fields/DatePicker.svelte
- packages/ui/src/lib/components/fields/DateTimePicker.svelte
- packages/ui/src/lib/components/fields/RelationPicker.svelte
- packages/ui/src/lib/components/fields/JSONEditor.svelte
- packages/ui/src/lib/components/fields/TagInput.svelte
- packages/ui/src/lib/components/fields/TextArea.svelte
- packages/ui/tests/components/fields.test.ts (31 tests)
**Test results**: 398 passed, 0 failed
**Review**: All 10 form field components implemented as Svelte 5 components using $props() and $bindable() runes. TextInput renders labeled text input with value binding. NumberInput renders type="number" with numeric value binding. Toggle renders checkbox with boolean checked binding via aria-label for accessibility. Select renders <select> with string options and value binding. DatePicker renders type="date", DateTimePicker renders type="datetime-local". RelationPicker renders text input for UUID FK values (will be enhanced with lookup in later tasks). JSONEditor renders textarea with monospace styling for JSON content. TagInput renders tag chips with Enter-to-add and remove buttons, using internal inputValue state. TextArea renders multiline textarea. All components support label, value, required, disabled, and error props. Error messages render as inline "This field is required" text. All use id={label} and for={label} for label-input association (Toggle uses aria-label within label wrapper). 31 tests cover: rendering with label/value, value binding on input/change, required error display, and disabled state. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —

### 2026-03-08 — T-034: AutoForm component
**Status**: DONE
**Commit**: 5efca40
**Duration**: ~8 min
**Files created/modified**:
- packages/ui/src/lib/components/AutoForm.svelte
- packages/ui/src/lib/components/ConfirmDialog.svelte
- packages/ui/src/lib/components/Toast.svelte
- packages/ui/tests/components/auto-form.test.ts
**Test results**: 413 passed, 0 failed
**Review**: AutoForm generates correct field components from ColumnMeta[] via getFieldComponent() mapping (B-UI-009). Edit mode populates values into fields (B-UI-010). Required validation prevents submit when nullable:false + hasDefault:false fields are empty, showing inline "This field is required" error (B-UI-011). PK and generated/hasDefault columns hidden in create mode (B-UI-012). readOnlyColumns rendered but disabled in edit mode (B-UI-013). onSubmit called with form data on Save click (B-UI-014). Delete button shown only when onDelete provided; triggers callback (B-UI-015). ConfirmDialog renders title/message with Confirm/Cancel buttons, hidden when open=false. Toast renders message with type-based CSS class (success/error/warning/info), hidden when visible=false. All 3 components use Svelte 5 $props() runes. 15 tests cover all specified behaviors. No circular deps. Lint, typecheck, build, test all pass.
**Notes**: —
