# ADR-005: JWT Authentication with PostgreSQL-Native Authorization

## Status
Accepted

## Context
The framework needs authentication (who are you?) and authorization (what can you do?). These are separate concerns with different implementation strategies.

**Authentication options:**
- JWT tokens (stateless, widely understood)
- Session-based (server-side state)
- OAuth2/OIDC delegation (external provider)

**Authorization options:**
- Application-layer middleware (check permissions in code)
- PostgreSQL-native (database roles + grants + RLS)
- Hybrid (application reads permissions, database enforces)

## Decision

### Authentication: JWT (default, swappable)
- JWT access tokens (short-lived: 15 min) + refresh tokens (long-lived: 7 days)
- Signed with HS256 using `auth.secret` from config
- Payload: `{ userId, tenantId, role }` (role is the functional database role name)
- Auth provider is swappable via `AuthProvider` interface — OIDC, SAML, etc. can replace JWT

### Authorization: PostgreSQL-native (functional roles + grants + RLS)

**Functional roles** (not per-user roles):
- `authenticator`: Connection role, switches to other roles via `SET LOCAL role`
- `anon`: Unauthenticated requests
- `app_viewer`: Read-only access
- `app_editor`: Read + write access
- `app_admin`: Full access including delete and system administration

**Permission enforcement layers:**
1. **Table-level GRANT**: Which tables each role can SELECT/INSERT/UPDATE/DELETE
2. **Column-level GRANT**: Which columns each role can access for each operation
3. **RLS policies**: Row-level filtering (e.g., tenant isolation, ownership)

**Per-request flow:**
1. Auth middleware extracts and verifies JWT
2. JWT payload maps to pgSettings: `role`, `app.user_id`, `app.tenant_id`
3. PostGraphile sets `SET LOCAL` with these settings before each query
4. PostgreSQL enforces grants and RLS — no application-layer permission checks needed

**RBAC definition:**
- Roles defined in simplicity-schema YAML (`schema/roles/*.yaml`)
- Table + column grants defined in table YAML (`grants:` section)
- RLS policies defined in table YAML (`policies:` section)
- This is the "code ceiling" — the maximum permission level
- Admin UI can further RESTRICT (never EXPAND) via override table in system schema

## Consequences
**Positive:**
- Authorization cannot be bypassed by application bugs (enforced by PostgreSQL)
- Column-level RBAC is a first-class PostgreSQL feature (GRANT on columns)
- RLS provides transparent row-level filtering without query modification
- Functional roles are shared across users (not N roles for N users)
- Permissions are version-controlled via simplicity-schema YAML

**Negative:**
- Requires PostgreSQL (RLS + column grants are PG-specific)
- Debugging permission issues requires understanding PG role system
- `SET LOCAL role` per request adds slight overhead

**Risks:**
- Complex RLS policies can impact query performance
- Misconfigured grants could accidentally expose data (mitigated by `force_rls: true`)
