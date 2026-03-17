# Database Module Specification

**PRD Reference:** §5 (US-002)

## Overview

The database module (`@mabulu-inc/simplicity-admin-db`) handles PostgreSQL connectivity, schema introspection, system schema bootstrapping via simplicity-schema, and provides the default `DatabaseProvider` implementation. It converts live PostgreSQL schemas into the `SchemaMeta` model that drives all downstream modules.

## Package Location

- Package: `@mabulu-inc/simplicity-admin-db`
- Source: `packages/db/src/`
- Tests: `packages/db/tests/`
- System schema YAML: `packages/db/schema/`

## Dependencies

- `@mabulu-inc/simplicity-admin-core` — metadata types, provider interface, config types
- `@mabulu-inc/simplicity-schema` — declarative DDL, migration, DB introspection
- `pg` — PostgreSQL client (connection pooling)

## Public API

### Connection Management

```typescript
// packages/db/src/connection.ts

export function createPool(url: string): ConnectionPool;
```

`ConnectionPool` implements the interface from `@mabulu-inc/simplicity-admin-core/providers/types`.

### Introspection

```typescript
// packages/db/src/introspect/index.ts

export function introspectSchema(pool: ConnectionPool, schema?: string): Promise<SchemaMeta>;
```

```typescript
// packages/db/src/introspect/tables.ts
export function listTables(pool: ConnectionPool, schema?: string): Promise<TableMeta[]>;

// packages/db/src/introspect/columns.ts
export function introspectColumns(pool: ConnectionPool, tableName: string, schema?: string): Promise<ColumnMeta[]>;

// packages/db/src/introspect/relations.ts
export function introspectRelations(pool: ConnectionPool, schema?: string): Promise<RelationMeta[]>;

// packages/db/src/introspect/enums.ts
export function introspectEnums(pool: ConnectionPool, schema?: string): Promise<EnumMeta[]>;
```

### Bootstrap

```typescript
// packages/db/src/bootstrap.ts

export function bootstrap(pool: ConnectionPool, config: ProjectConfig): Promise<void>;
```

### Default Provider

```typescript
// packages/db/src/provider.ts

export function postgresProvider(): DatabaseProvider;
```

## Behavior Specification

### B-DB-001: Create Connection Pool
**Given** a valid PostgreSQL connection URL
**When** `createPool(url)` is called
**Then** returns a `ConnectionPool` that can execute queries

### B-DB-002: Connection Error
**Given** an invalid connection URL (bad host/port/credentials)
**When** `createPool(url)` is called and a query is attempted
**Then** throws a `DatabaseError` with a descriptive message (not raw pg error)

### B-DB-003: Pool Cleanup
**Given** an active connection pool
**When** `pool.end()` is called
**Then** all connections are released and no further queries can execute

### B-DB-004: List Tables
**Given** a database with tables `contacts`, `deals`, and `activities` in the `public` schema
**When** `listTables(pool, 'public')` is called
**Then** returns `TableMeta[]` with `name` matching each table, excluding system tables (`pg_*`, `information_schema.*`)

### B-DB-005: List Tables — Schema Filter
**Given** tables in both `public` and `internal` schemas
**When** `listTables(pool, 'public')` is called
**Then** returns only tables in the `public` schema

### B-DB-006: Introspect Columns
**Given** a table `contacts` with columns: `id (uuid PK default gen_random_uuid())`, `name (text NOT NULL)`, `email (varchar(255))`, `active (boolean DEFAULT true)`, `created_at (timestamptz DEFAULT now())`
**When** `introspectColumns(pool, 'contacts')` is called
**Then** returns `ColumnMeta[]` with correct `name`, `type`, `nullable`, `hasDefault`, `isPrimaryKey`, `maxLength` for each column

### B-DB-007: Introspect Columns — Enum Type
**Given** a column with type `article_status` (a user-defined enum)
**When** `introspectColumns()` is called
**Then** the column has `type: 'enum'` and `enumValues: ['draft', 'review', 'published']`

### B-DB-008: Introspect Columns — Generated Column
**Given** a generated column `full_name` (GENERATED ALWAYS AS first_name || ' ' || last_name STORED)
**When** `introspectColumns()` is called
**Then** the column has `isGenerated: true`

### B-DB-009: Introspect Relations
**Given** `deals.contact_id` references `contacts.id`
**When** `introspectRelations(pool, 'public')` is called
**Then** returns a `RelationMeta` with `fromTable: 'deals'`, `fromColumns: ['contact_id']`, `toTable: 'contacts'`, `toColumns: ['id']`, `type: 'many-to-one'`

### B-DB-010: Introspect Relations — Reverse
**Given** `deals.contact_id` references `contacts.id`
**When** `introspectRelations(pool, 'public')` is called
**Then** also returns a `RelationMeta` with `fromTable: 'contacts'`, `toTable: 'deals'`, `type: 'one-to-many'`

### B-DB-011: Introspect Enums
**Given** a PostgreSQL enum type `article_status` with values `['draft', 'review', 'published']`
**When** `introspectEnums(pool, 'public')` is called
**Then** returns `EnumMeta` with `name: 'article_status'` and `values` in defined order

### B-DB-012: Full Schema Assembly
**Given** a database with multiple tables, relations, and enums
**When** `introspectSchema(pool, 'public')` is called
**Then** returns `SchemaMeta` with all tables (including columns), all relations (both directions), and all enums

### B-DB-013: Bootstrap — Fresh Database
**Given** a PostgreSQL database with no system schema
**When** `bootstrap(pool, config)` is called
**Then** creates the system schema with `users`, `tenants`, `memberships` tables, database roles, functions, and RLS policies using simplicity-schema

### B-DB-014: Bootstrap — Idempotent
**Given** a database where bootstrap has already run
**When** `bootstrap(pool, config)` is called again
**Then** completes without error (simplicity-schema handles idempotency)

### B-DB-015: Bootstrap — Creates Default Tenant
**Given** a fresh bootstrap
**When** bootstrap completes
**Then** a default tenant named 'Default' exists in the tenants table

### B-DB-016: Bootstrap — Creates Default Admin
**Given** a fresh bootstrap
**When** bootstrap completes
**Then** a default admin user exists (email: admin@localhost, password: changeme) with `super_admin: true` and a membership to the default tenant with the `app_admin` role

### B-DB-017: Generate YAML from DB
**Given** an existing database with tables
**When** `provider.generate(pool, outputDir, schema)` is called
**Then** creates simplicity-schema YAML files in outputDir representing the current database schema (delegates to simplicity-schema's generateFromDb)

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Connection failed | DatabaseError | DB_001 | Throw with connection URL (password masked) and original error |
| Query failed | DatabaseError | DB_002 | Throw with query summary and original error |
| Introspection failed | DatabaseError | DB_003 | Throw with table/schema name and original error |
| Bootstrap failed | DatabaseError | DB_004 | Throw with migration details and original error |
| Schema-flow error | DatabaseError | DB_005 | Wrap simplicity-schema error with context |

## Security Considerations

- Connection URLs containing passwords must be masked in all error messages and logs (show `postgres://user:***@host/db`)
- The bootstrap default admin password (`changeme`) must be flagged with a startup warning: "Default admin password detected. Change it immediately."
- Pool connections must use parameterized queries ONLY. Never interpolate user input into SQL.

## Test Requirements

### Unit Tests
- [ ] `createPool()` returns object implementing `ConnectionPool` interface
- [ ] Column type mapping covers all common PostgreSQL types
- [ ] Password masking in error messages works correctly

### Integration Tests (require real Postgres)
- [ ] `createPool()` connects to real Postgres and executes a query
- [ ] `createPool()` with bad URL throws `DatabaseError`
- [ ] `pool.end()` cleanly closes connections
- [ ] `listTables()` returns correct tables, excludes system tables
- [ ] `listTables()` respects schema filter
- [ ] `introspectColumns()` returns correct metadata for all column types
- [ ] `introspectColumns()` detects primary keys
- [ ] `introspectColumns()` detects nullable/non-nullable
- [ ] `introspectColumns()` detects defaults
- [ ] `introspectColumns()` detects enum columns with values
- [ ] `introspectColumns()` detects generated columns
- [ ] `introspectRelations()` detects foreign key relationships
- [ ] `introspectRelations()` produces both directions (many-to-one + one-to-many)
- [ ] `introspectEnums()` returns enum types with correct value ordering
- [ ] `introspectSchema()` assembles complete SchemaMeta
- [ ] `bootstrap()` creates system schema on fresh database
- [ ] `bootstrap()` is idempotent (running twice is safe)
- [ ] `bootstrap()` creates default tenant and admin user
- [ ] `generate()` produces YAML files from existing database

## File Manifest

```
packages/db/
  src/
    index.ts                    # Public API re-exports
    connection.ts               # createPool()
    bootstrap.ts                # bootstrap() orchestrator
    provider.ts                 # postgresProvider() default implementation
    introspect/
      index.ts                  # introspectSchema() orchestrator
      tables.ts                 # listTables()
      columns.ts                # introspectColumns()
      relations.ts              # introspectRelations()
      enums.ts                  # introspectEnums()
  schema/                       # simplicity-schema YAML (system schema)
    tables/
      users.yaml
      tenants.yaml
      memberships.yaml
    roles/
      authenticator.yaml
      anon.yaml
      app_viewer.yaml
      app_editor.yaml
      app_admin.yaml
    functions/
      current_user_id.yaml
      current_tenant_id.yaml
      begin_session.yaml
    mixins/
      timestamps.yaml
      tenant_scoped.yaml
      auditable.yaml
    enums/
  tests/
    connection.test.ts
    introspect.test.ts          # Integration tests for all introspection
    bootstrap.test.ts           # Integration tests for bootstrap
  package.json
  tsconfig.json
```

## Decision References

- ADR-001: PostgreSQL-first database strategy, simplicity-schema for DDL
- ADR-006: Provider pattern — postgresProvider() is the default DatabaseProvider
