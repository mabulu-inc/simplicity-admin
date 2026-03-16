# ADR-001: PostgreSQL-First Database Strategy

## Status
Accepted

## Context
The framework needs a database strategy. Options considered:
1. Multi-database abstraction from day one (support Postgres, MySQL, SQLite, etc.)
2. PostgreSQL-only with no abstraction
3. PostgreSQL-first with clean seams for future adapters

PostgreSQL offers unique features critical to the framework's security model: Row-Level Security (RLS), column-level GRANT permissions, functional database roles, and stored functions. These features provide database-level enforcement of access control — not just application-layer middleware that can be bypassed.

## Decision
**PostgreSQL-first with clean seams.** The framework is built to deeply leverage PostgreSQL features (RLS, grants, roles, functions). The `DatabaseProvider` interface in `@simplicity-admin/core` provides the seam for future database adapters, but the initial implementation assumes PostgreSQL.

Schema management uses `@mabulu-inc/simplicity-schema` for declarative DDL via YAML files. simplicity-schema handles table creation, enum management, role definitions, RLS policies, column-level grants, triggers, functions, and zero-downtime migrations.

Key integration points:
- **Bootstrap**: simplicity-schema YAML defines the system schema (users, tenants, memberships, roles)
- **Introspection**: Direct `information_schema` + `pg_catalog` queries for runtime metadata
- **Permissions**: simplicity-schema YAML defines grants and RLS policies (code-first RBAC)
- **Generation**: `simplicity-schema generate` introspects existing databases to create YAML files

## Consequences
**Positive:**
- Security enforcement at the database level (RLS + grants) — cannot be bypassed by application bugs
- Rich introspection capabilities (PostgreSQL has excellent metadata tables)
- simplicity-schema provides declarative, version-controlled schema management
- Zero-downtime migrations via simplicity-schema's expand/contract pattern

**Negative:**
- Framework cannot be used with MySQL/SQLite without significant adapter work
- Developers must have access to a PostgreSQL instance for development (Docker Compose mitigates this)
- PostgreSQL-specific SQL in some queries (e.g., `current_setting()`, `SET LOCAL`)

**Risks:**
- simplicity-schema is an internal dependency — changes to its API require coordinated updates
- PostgreSQL version requirements (RLS requires 9.5+, but we target 14+ for best support)
