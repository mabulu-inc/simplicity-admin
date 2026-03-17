---
title: "@mabulu-inc/simplicity-admin-db"
description: PostgreSQL connection pooling, schema introspection, and system schema bootstrap.
---

The `db` package implements the `DatabaseProvider` interface from `core`. It manages the PostgreSQL connection, introspects the database schema, and bootstraps the internal system schema.

**Dependencies:** `@mabulu-inc/simplicity-admin-core`, `simplicity-schema`

## Connection Pooling

The `db` package establishes a connection pool to PostgreSQL on startup. The pool is shared across all subsystems (API, auth, introspection) to minimize connection overhead.

```ts
// Connection is managed internally. Configure via the database option:
export default defineConfig({
  database: 'postgres://user:password@localhost:5432/mydb',
});
```

The pool automatically handles connection retries and cleanup on shutdown.

## Schema Introspection

On startup, the `db` package queries `information_schema` to build a complete `SchemaMeta` object:

### What Gets Introspected

| PostgreSQL Object | Output |
|------------------|--------|
| Tables | `TableMeta[]` with name, schema, primary key |
| Columns | `ColumnMeta[]` with name, type, nullability, defaults |
| Foreign keys | `RelationMeta[]` with cardinality resolution |
| Enums | `EnumMeta[]` with name and values |

### Introspection Scope

Only the configured application schema is introspected (default: `public`). System schemas (`pg_catalog`, `information_schema`, `_simplicity_admin`) are excluded.

```ts
export default defineConfig({
  database: process.env.DATABASE_URL,
  schema: 'my_app_schema', // Introspect this schema instead of public
});
```

## System Schema Bootstrap

On first startup, the `db` package creates the `_simplicity_admin` system schema using simplicity-schema. This schema stores:

- **Users** — Admin user accounts (email, password hash, roles)
- **Sessions** — Active refresh tokens
- **Role assignments** — User-to-role mappings
- **Saved views** — User-customized list/detail view configurations
- **Audit log** — Record of mutations performed through the admin

The system schema is managed entirely by SIMPLICITY-ADMIN. On subsequent startups, simplicity-schema runs any necessary migrations to keep the system schema up to date.

## Disconnect

On shutdown, the `db` package drains the connection pool and closes all connections cleanly. This is triggered automatically by the `onShutdown` lifecycle hook.
