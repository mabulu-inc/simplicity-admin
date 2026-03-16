# Multi-Tenancy Module Specification

**PRD Reference:** §2, §3, §6 (NFR-007)

## Overview

The tenancy module provides first-class multi-tenancy support that is architecturally present from day one but completely invisible when not configured. When enabled, it provides row-level data isolation via PostgreSQL RLS, tenant resolution from incoming requests, and a tenant-switching UI.

Multi-tenancy is NOT a separate package — it is woven into `@simplicity-admin/core` (config types), `@simplicity-admin/db` (tenant_scoped mixin, RLS policies), `@simplicity-admin/auth` (tenant in JWT, membership model), and `@simplicity-admin/ui` (tenant switcher). This spec documents the cross-cutting concerns.

## Package Location

- Tenancy config: `packages/core/src/config/types.ts` (TenancyConfig)
- Tenant resolution: `packages/auth/src/tenancy/`
- Tenant-scoped mixin: `packages/db/schema/mixins/tenant_scoped.yaml`
- Tenant switcher UI: `packages/ui/src/lib/components/TenantSwitcher.svelte`

## Dependencies

Cross-cutting — touches core, db, auth, and ui packages.

## Public API

### Tenant Resolution Middleware

```typescript
// packages/auth/src/tenancy/resolver.ts

export function createTenantResolver(config: TenancyConfig, pool: ConnectionPool): HttpMiddleware;
```

Resolves the current tenant from the request based on `config.resolution` strategy:
- `'header'`: reads `config.header` (default: `x-tenant-id`)
- `'subdomain'`: extracts from `Host` header (e.g., `acme.app.com` → tenant slug `acme`)
- `'path'`: extracts from URL path (e.g., `/t/acme/...` → tenant slug `acme`)

### Tenant Management

```typescript
// packages/auth/src/tenancy/management.ts

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export function createTenant(pool: ConnectionPool, data: { name: string; slug: string }): Promise<Tenant>;
export function getTenantById(pool: ConnectionPool, id: string): Promise<Tenant | null>;
export function getTenantBySlug(pool: ConnectionPool, slug: string): Promise<Tenant | null>;
export function listTenantsForUser(pool: ConnectionPool, userId: string): Promise<Tenant[]>;
export function listAllTenants(pool: ConnectionPool): Promise<Tenant[]>;  // Super-admin only
```

### Tenant Context

```typescript
// packages/auth/src/tenancy/context.ts

export function getCurrentTenantId(req: IncomingMessage): string | undefined;
export function setTenantPgSettings(tenantId: string | undefined, superAdmin: boolean): Record<string, string>;
```

## Behavior Specification

### B-TEN-001: Disabled by Default
**Given** no `tenancy` config is specified
**When** the application starts
**Then** no tenant resolution middleware runs, no tenant switcher appears in UI, no tenant_id is set in pgSettings

### B-TEN-002: Single Tenant Auto-Created
**Given** tenancy is disabled (default)
**When** bootstrap runs
**Then** a single "Default" tenant is created and all users are automatically members of it

### B-TEN-003: Tenant Resolution — Header
**Given** `tenancy: { enabled: true, resolution: 'header', header: 'x-tenant-id' }`
**When** a request arrives with header `x-tenant-id: <uuid>`
**Then** the tenant context is set to that UUID

### B-TEN-004: Tenant Resolution — Subdomain
**Given** `tenancy: { enabled: true, resolution: 'subdomain' }`
**When** a request arrives with `Host: acme.app.com`
**Then** the tenant is resolved by looking up slug `acme` in the tenants table

### B-TEN-005: Tenant Resolution — Path
**Given** `tenancy: { enabled: true, resolution: 'path' }`
**When** a request arrives at `/t/acme/contacts`
**Then** the tenant is resolved by looking up slug `acme`, and the request path is rewritten to `/contacts`

### B-TEN-006: Tenant Resolution — Not Found
**Given** a request references a tenant that doesn't exist
**When** the tenant resolver processes the request
**Then** responds with 404 and `{ error: "Tenant not found" }`

### B-TEN-007: Tenant Resolution — Missing
**Given** tenancy is enabled but no tenant identifier in the request
**When** the tenant resolver processes the request
**Then** responds with 400 and `{ error: "Tenant identifier required" }`

### B-TEN-021: Tenant Resolution — Applies Before Auth
**Given** tenancy is enabled with `resolution: 'subdomain'`
**When** a user visits `acme.app.com/admin/login` (unauthenticated)
**Then** the tenant is resolved to Acme BEFORE the login page renders — the login page shows only Acme's available auth strategies. No tenant list is ever exposed to unauthenticated users.

### B-TEN-008: pgSettings Include Tenant
**Given** a resolved tenant with id T and non-super-admin user
**When** `setTenantPgSettings(T, false)` is called
**Then** returns `{ 'app.tenant_id': T, 'app.is_super_admin': 'false' }`

### B-TEN-008b: pgSettings — Super-Admin with Tenant
**Given** a super-admin with resolved tenant T
**When** `setTenantPgSettings(T, true)` is called
**Then** returns `{ 'app.tenant_id': T, 'app.is_super_admin': 'true' }`

### B-TEN-008c: pgSettings — Super-Admin Global Mode
**Given** a super-admin in global mode (no tenant selected)
**When** `setTenantPgSettings(undefined, true)` is called
**Then** returns `{ 'app.is_super_admin': 'true' }` — no `app.tenant_id` is set

### B-TEN-009: RLS Enforces Tenant Isolation
**Given** two tenants A and B, each with contacts
**When** user in tenant A queries contacts
**Then** only tenant A's contacts are returned (RLS policy: `tenant_id = current_setting('app.tenant_id')::uuid`)

### B-TEN-010: User Tenant Switching
**Given** user Alice is a member of tenants A and B
**When** Alice requests `listTenantsForUser(pool, alice.id)`
**Then** returns both tenants A and B

### B-TEN-014: Tenant Switch Re-scopes Roles
**Given** Alice has role `app_admin` in tenant A but only `app_viewer` in tenant B
**When** Alice switches from tenant A to tenant B via `POST /auth/switch-tenant`
**Then** the new JWT has `tenantId: B`, `roles: ["app_viewer"]`, `activeRole: "app_viewer"` — roles are always scoped to the active tenant's memberships

### B-TEN-015: Single Tenant — UI Hides Switcher
**Given** user Bob is a member of only one tenant
**When** the admin UI renders
**Then** the tenant name is displayed in the TopBar but the dropdown trigger is hidden

### B-TEN-016: Super-Admin — All Tenants Listed
**Given** super-admin SuperSam has no explicit memberships beyond the default tenant, and tenants Acme, Globex, and Default exist
**When** the tenant switcher renders for SuperSam
**Then** all three tenants are shown in the dropdown (super-admins see all tenants, not just memberships)

### B-TEN-017: Super-Admin — Global Mode
**Given** super-admin SuperSam selects "Global" from the tenant switcher
**When** the switch completes
**Then** `tenantId` is unset in the JWT, `app.tenant_id` is not set in pgSettings, and the RLS super-admin exception allows all rows from all tenants to be visible

### B-TEN-018: Super-Admin — RLS Bypass
**Given** RLS policy on a tenant_scoped table: `tenant_id = current_setting('app.tenant_id')::uuid OR current_setting('app.is_super_admin', true)::boolean = true`
**When** super-admin is in global mode (no `app.tenant_id` set, `app.is_super_admin = true`)
**Then** all rows across all tenants are returned

### B-TEN-019: Super-Admin — Scoped to Tenant
**Given** super-admin SuperSam has switched to tenant Acme (not global mode)
**When** SuperSam queries contacts
**Then** only Acme's contacts are returned (RLS filters by `tenant_id` as normal — the super-admin exception only applies when `app.tenant_id` is not set)

### B-TEN-020: Non-Super-Admin — No RLS Bypass
**Given** a regular user with `app.is_super_admin` not set (defaults to false)
**When** the user queries a tenant_scoped table
**Then** RLS enforces the standard `tenant_id = current_setting('app.tenant_id')::uuid` filter — no cross-tenant access

### B-TEN-011: Tenant-Scoped Mixin
**Given** a table YAML using `use: [tenant_scoped]`
**When** schema-flow runs
**Then** the table gets a `tenant_id` column (uuid, NOT NULL, FK to tenants.id), an RLS policy (`tenant_id = current_setting('app.tenant_id')::uuid OR current_setting('app.is_super_admin', true)::boolean = true`), and `force_rls: true`

### B-TEN-012: Create Tenant
**Given** valid tenant data `{ name: "Acme Corp", slug: "acme" }`
**When** `createTenant(pool, data)` is called
**Then** inserts the tenant and returns the created `Tenant` object

### B-TEN-013: Duplicate Tenant Slug
**Given** a tenant with slug "acme" already exists
**When** `createTenant(pool, { name: "Another", slug: "acme" })` is called
**Then** throws `TenancyError` with code `TEN_002`

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Tenant not found (by ID or slug) | TenancyError | TEN_001 | 404 response or null return |
| Duplicate tenant slug | TenancyError | TEN_002 | Throw with conflicting slug |
| Missing tenant in request (when required) | TenancyError | TEN_003 | 400 response |
| User not a member of requested tenant | TenancyError | TEN_004 | 403 response |

## Security Considerations

- Tenant isolation is enforced by PostgreSQL RLS, NOT application code. Even if the middleware fails, the database will not return cross-tenant data.
- `force_rls: true` ensures that even the table owner role cannot bypass RLS.
- Tenant IDs in headers/paths must be validated as UUIDs (or slugs must be validated as alphanumeric) to prevent injection.
- A user can only switch to tenants they have an active membership in.

## Test Requirements

### Unit Tests
- [ ] `setTenantPgSettings()` returns correct pgSettings for regular user
- [ ] `setTenantPgSettings()` includes `app.is_super_admin: 'true'` for super-admin
- [ ] `setTenantPgSettings()` omits `app.tenant_id` for super-admin in global mode
- [ ] Tenant resolution correctly extracts from header
- [ ] Tenant resolution correctly extracts subdomain from Host header
- [ ] Tenant resolution correctly extracts slug from path and rewrites

### Integration Tests (require real Postgres)
- [ ] Bootstrap creates default tenant when tenancy disabled
- [ ] `createTenant()` inserts tenant
- [ ] `createTenant()` rejects duplicate slug
- [ ] `getTenantBySlug()` returns correct tenant
- [ ] `listTenantsForUser()` returns all tenants user is member of
- [ ] RLS isolates data between tenants (query as tenant A, get only A's data)
- [ ] Tenant resolution middleware sets correct pgSettings
- [ ] Full flow: enable tenancy → create tenants → create data in each → verify isolation
- [ ] Super-admin in global mode sees rows from all tenants
- [ ] Super-admin scoped to a tenant sees only that tenant's rows
- [ ] Regular user cannot bypass tenant RLS even if `app.is_super_admin` is manually set (enforced by auth middleware, not user input)

## File Manifest

```
packages/auth/
  src/
    tenancy/
      resolver.ts               # Tenant resolution middleware
      management.ts             # CRUD for tenants
      context.ts                # Request context helpers
packages/db/
  schema/
    mixins/
      tenant_scoped.yaml        # Mixin adding tenant_id + RLS
    tables/
      tenants.yaml              # Tenants table definition
packages/ui/
  src/
    lib/
      components/
        TenantSwitcher.svelte   # Tenant switching dropdown
```

## Decision References

- ADR-001: PostgreSQL-first — RLS for tenant isolation
- ADR-005: Functional roles + PG-native authorization
