# RBAC Module Specification

## Overview

The RBAC (Role-Based Access Control) module provides column-level permission management. Permissions are defined code-first in schema-flow YAML files (grants, policies, roles) and enforced at the PostgreSQL level. The admin UI allows further restriction of permissions but can NEVER exceed the code-defined ceiling. This module reads effective permissions and exposes them to the UI for rendering decisions.

## Package Location

- Package: `@simplicity-admin/auth` (RBAC is part of the auth package)
- Source: `packages/auth/src/rbac/`
- Tests: `packages/auth/tests/rbac/`

## Dependencies

- `@simplicity-admin/core` — metadata types, config types
- `@simplicity-admin/db` — connection pool, introspection

## Public API

### Permission Types

```typescript
// packages/auth/src/rbac/types.ts

export type Operation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface TablePermission {
  table: string;
  schema: string;
  operations: Operation[];
  columnPermissions: ColumnPermission[];
}

export interface ColumnPermission {
  column: string;
  operations: Operation[];  // Which operations this column is allowed for
}

export interface EffectivePermissions {
  role: string;
  tables: TablePermission[];
}
```

### Permission Engine

```typescript
// packages/auth/src/rbac/engine.ts

/** Reads effective permissions from DB (code grants + UI overrides merged) */
export function getEffectivePermissions(
  pool: ConnectionPool,
  role: string,
  schema?: string
): Promise<EffectivePermissions>;

/** Checks if a role can perform an operation on a table */
export function canAccess(
  permissions: EffectivePermissions,
  table: string,
  operation: Operation
): boolean;

/** Checks if a role can perform an operation on a specific column */
export function canAccessColumn(
  permissions: EffectivePermissions,
  table: string,
  column: string,
  operation: Operation
): boolean;

/** Returns the list of columns a role can see/edit for a table */
export function getAccessibleColumns(
  permissions: EffectivePermissions,
  table: string,
  operation: Operation
): string[];
```

### UI Permission Overrides

```typescript
// packages/auth/src/rbac/overrides.ts

export interface PermissionOverride {
  id: string;
  role: string;
  table: string;
  column?: string;          // null = table-level
  operation: Operation;
  denied: boolean;          // true = deny (can only deny, never grant beyond code ceiling)
  createdBy: string;
  createdAt: Date;
}

/** Save a UI-defined permission override (restrict only, never expand) */
export function saveOverride(pool: ConnectionPool, override: Omit<PermissionOverride, 'id' | 'createdAt'>): Promise<PermissionOverride>;

/** Remove a UI-defined override (restores to code-defined permission) */
export function removeOverride(pool: ConnectionPool, overrideId: string): Promise<void>;

/** List all overrides for a role */
export function listOverrides(pool: ConnectionPool, role: string): Promise<PermissionOverride[]>;
```

## Behavior Specification

### B-RBAC-001: Read Code-Defined Permissions
**Given** schema-flow YAML grants `app_viewer` SELECT on `contacts` columns `[id, name, email]`
**When** `getEffectivePermissions(pool, 'app_viewer')` is called
**Then** returns permissions showing SELECT on contacts for columns id, name, email only

### B-RBAC-002: Column-Level Restriction
**Given** `app_viewer` has SELECT on contacts columns `[id, name, email]` but NOT `salary`
**When** `canAccessColumn(perms, 'contacts', 'salary', 'SELECT')` is called
**Then** returns `false`

### B-RBAC-003: Table-Level Check
**Given** `app_viewer` has SELECT on `contacts` but NO permissions on `audit_log`
**When** `canAccess(perms, 'audit_log', 'SELECT')` is called
**Then** returns `false`

### B-RBAC-004: Accessible Columns
**Given** `app_editor` has SELECT on contacts columns `[id, name, email]` and UPDATE on `[name, email]`
**When** `getAccessibleColumns(perms, 'contacts', 'UPDATE')` is called
**Then** returns `['name', 'email']`

### B-RBAC-005: UI Override — Deny Column
**Given** code grants `app_editor` UPDATE on contacts column `email`
**When** an admin creates a UI override denying `app_editor` UPDATE on contacts.email
**Then** `canAccessColumn(perms, 'contacts', 'email', 'UPDATE')` returns `false`

### B-RBAC-006: UI Override — Cannot Expand
**Given** code does NOT grant `app_viewer` UPDATE on contacts
**When** an admin attempts to create a UI override granting `app_viewer` UPDATE on contacts
**Then** the override is rejected (throws `RBACError` with code `RBAC_003`)

### B-RBAC-007: UI Override — Remove Restores Code Permission
**Given** a UI override denying `app_editor` SELECT on contacts.email exists
**When** `removeOverride(pool, overrideId)` is called
**Then** `canAccessColumn(perms, 'contacts', 'email', 'SELECT')` returns `true` (restored to code ceiling)

### B-RBAC-008: Admin Role Has Full Access
**Given** `app_admin` has all privileges on all tables (via schema-flow YAML)
**When** `canAccess(perms, 'any_table', 'DELETE')` is called
**Then** returns `true`

### B-RBAC-009: Merged Permissions (Code + UI)
**Given** code grants `app_editor` SELECT, INSERT, UPDATE on contacts
**And** a UI override denies `app_editor` UPDATE on contacts.salary
**When** `getEffectivePermissions()` is called
**Then** returns merged result: SELECT all columns, INSERT all columns, UPDATE all columns except salary

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Role not found in DB | RBACError | RBAC_001 | Throw with role name |
| Table not found | RBACError | RBAC_002 | Throw with table name |
| Override exceeds code ceiling | RBACError | RBAC_003 | Throw: "Cannot grant permissions beyond code-defined ceiling" |
| Override for non-existent column | RBACError | RBAC_004 | Throw with column name |

## Security Considerations

- RBAC enforcement is at the DATABASE level (grants + RLS). The RBAC engine in this module READS permissions for UI rendering — it does not ENFORCE them. PostgreSQL enforces.
- UI overrides are DENY-only. The system must never allow a UI override to grant access beyond what the code-defined YAML permits.
- Permission queries must be executed as a privileged role (not the user's role) to read the full permission picture.

## Test Requirements

### Unit Tests
- [ ] `canAccess()` returns true for granted table operation
- [ ] `canAccess()` returns false for non-granted table operation
- [ ] `canAccessColumn()` returns true for granted column
- [ ] `canAccessColumn()` returns false for non-granted column
- [ ] `getAccessibleColumns()` returns correct column list for operation

### Integration Tests (require real Postgres with schema-flow grants applied)
- [ ] `getEffectivePermissions()` reads correct grants from database
- [ ] `getEffectivePermissions()` includes column-level grant detail
- [ ] `getEffectivePermissions()` merges UI overrides with code grants
- [ ] `saveOverride()` persists deny override
- [ ] `saveOverride()` rejects override that exceeds code ceiling
- [ ] `removeOverride()` restores code-defined permission
- [ ] `listOverrides()` returns all overrides for a role
- [ ] Full flow: define grants in YAML → run schema-flow → read permissions → override via UI → verify merge

## File Manifest

```
packages/auth/
  src/
    rbac/
      types.ts                  # Permission types
      engine.ts                 # Permission reading + checking
      overrides.ts              # UI permission overrides
  tests/
    rbac/
      engine.test.ts            # Unit tests for canAccess/canAccessColumn
      overrides.test.ts         # Integration tests for UI overrides
      integration.test.ts       # Full flow integration test
```

## Decision References

- ADR-005: JWT auth default, functional roles, PG-native authorization
- ADR-001: PostgreSQL-first — grants and RLS are the enforcement layer
