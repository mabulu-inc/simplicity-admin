# Security Hardening Specification

**PRD Reference:** §6 (NFR-005, NFR-006, NFR-007, NFR-008, NFR-009)

## Overview

This spec addresses findings from the adversarial security audit performed on 2026-03-09. It covers authentication hardening, authorization enforcement, input validation, API protection, and production readiness.

---

## B-SEC-001: JWT Secret Validation

The JWT provider and SvelteKit hooks fall back to `'development-secret'` when `SIMPLICITY_ADMIN_AUTH_SECRET` is unset. This must be blocked in production.

**Requirements:**
- On startup, if `NODE_ENV === 'production'` and the auth secret equals `'development-secret'` or is shorter than 32 characters, throw a `ConfigError` with a clear message
- In non-production environments, log a warning when the default secret is in use
- Update the Zod config schema to add `.min(32)` validation on `auth.secret` when provided

---

## B-SEC-002: Server-Side RBAC Enforcement on Mutations

The `update`, `delete`, and `transition` form actions in `[table]/[id]/+page.server.ts` and the `default` action in `[table]/new/+page.server.ts` do not check RBAC permissions server-side. The UI hides buttons but a crafted POST request bypasses this.

**Requirements:**
- Every form action (`update`, `delete`, `transition`, `default` create) must:
  1. Verify `locals.user` exists (return 401 if not)
  2. Load RBAC info via `getTableRbacInfo()` for the user's active role
  3. Check the relevant permission (`canUpdate`, `canDelete`, `canInsert`) before executing the query
  4. Return 403 with `{ error: 'Permission denied' }` if the check fails
- For `update`: additionally verify that submitted column names are within `rbac.visibleColumns` minus `rbac.readOnlyColumns` (not just `validColumns` from schema)
- The `transition` action must verify the user's role is authorized for the specific transition (already partially implemented — verify it cannot be bypassed)

---

## B-SEC-003: SQL Identifier Safety

Table names from `params.table` and column names from schema metadata are interpolated into SQL using manual double-quote wrapping (`"${name}"`). While table names are validated against schema metadata, column names are trusted from `information_schema`.

**Requirements:**
- Create a shared `escapeIdentifier(name: string): string` utility in `@mabulu-inc/simplicity-admin-db` that properly escapes SQL identifiers (replace `"` with `""`, wrap in double quotes)
- Replace all manual `"${name}"` interpolation in `+page.server.ts` files with the utility
- Replace the `ident()` function in `bootstrap.ts` with the shared utility
- Add tests for edge cases: names with quotes, unicode, reserved words

---

## B-SEC-004: Rate Limiting on Auth Endpoints

No rate limiting exists on login, refresh, or any auth endpoint.

**Requirements:**
- Implement a simple in-memory rate limiter (configurable, replaceable via provider pattern)
- Apply to auth routes: `/auth/login`, `/auth/refresh`
- Default limits: 10 attempts per IP per 15-minute window on login, 30 per window on refresh
- Return 429 with `Retry-After` header when limit is exceeded
- Rate limiter must be bypassable in test environments

---

## B-SEC-005: Request Body Size Limiting

The `parseBody()` helper in `packages/auth/src/routes/helpers.ts` reads the entire request body into memory with no size limit.

**Requirements:**
- Add a configurable max body size (default: 1 MB)
- If the accumulated body exceeds the limit, destroy the request stream and return 413
- Apply to all auth route handlers

---

## B-SEC-006: Error Message Sanitization

Raw PostgreSQL error messages are returned to the client in form action responses, potentially leaking internal schema details.

**Requirements:**
- Create a `sanitizeDbError(err: Error): string` utility
- For constraint violations: return user-friendly messages (e.g., "A record with this value already exists" for unique violations, "Cannot delete: referenced by other records" for FK violations — the FK one is already partially done)
- For all other DB errors: return a generic "An error occurred while saving" message
- Log the full error server-side for debugging
- Apply to all form actions in `[table]/+page.server.ts`, `[table]/[id]/+page.server.ts`, `[table]/new/+page.server.ts`

---

## B-SEC-007: Token Revocation Persistence

Token revocation uses an in-memory `Set<string>` that is lost on restart and not shared across instances.

**Requirements:**
- Replace the in-memory set with a database-backed revocation table in the system schema: `_simplicity.revoked_tokens (token_hash text PRIMARY KEY, revoked_at timestamptz DEFAULT now(), expires_at timestamptz)`
- Store a SHA-256 hash of the token, not the token itself
- On revocation check, query the table
- Add a cleanup job or TTL index to purge expired entries (tokens older than refresh TTL)
- Keep the in-memory implementation as a fallback for environments without a DB connection (tests)

---

## B-SEC-008: GraphiQL Default Disabled

GraphiQL is enabled by default via `defaults.ts`, exposing the full schema to unauthenticated users.

**Requirements:**
- Change the default value of `graphiql` to `false` in `packages/core/src/config/defaults.ts`
- The CLI `dev` command should explicitly set `graphiql: true` for development convenience
- Update documentation to note that GraphiQL must be explicitly enabled
- Add a test verifying the default is `false`

---

## B-SEC-009: Timing-Safe Login

When a user doesn't exist, the login handler returns immediately without running bcrypt. When the user exists but password is wrong, bcrypt runs (~250ms). This timing difference reveals whether an email is registered.

**Requirements:**
- When the user is not found, run a dummy `bcrypt.compare()` against a pre-computed hash before returning 401
- This ensures constant-time response regardless of whether the user exists
- Apply to both `packages/auth/src/routes/login.ts` and `packages/ui/src/routes/api/auth/login/+server.ts`

---

## B-SEC-010: Refresh Token Rotation

When a refresh token is exchanged for a new pair, the old refresh token remains valid. A stolen refresh token can be used repeatedly for 7 days.

**Requirements:**
- On successful refresh, revoke the old refresh token (add to revocation store from B-SEC-007)
- If a revoked refresh token is presented, revoke ALL tokens for that user (potential token theft detected) and return 401
- Log the event for audit purposes

---

## B-SEC-011: Security Headers

No `Strict-Transport-Security`, `Content-Security-Policy`, or `X-Content-Type-Options` headers are set.

**Requirements:**
- Add a SvelteKit hook or middleware that sets:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production only)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- CSP can be deferred to a future task (complex with SvelteKit)

---

## B-SEC-012: GraphQL Depth and Complexity Limiting

No query depth or complexity limits are configured on the PostGraphile GraphQL endpoint.

**Requirements:**
- Configure a maximum query depth (default: 10)
- Reject queries exceeding the depth limit with a clear error message
- This should be configurable via `api.maxQueryDepth` in ProjectConfig

---

## B-SEC-013: `begin_session` Role Validation

The `begin_session` SECURITY DEFINER function accepts any role name and sets the session to it. If called directly, it could escalate privileges.

**Requirements:**
- Add a `CHECK` within the function body that `p_role` is one of the known functional roles: `'anon'`, `'app_viewer'`, `'app_editor'`, `'app_admin'`
- If an unknown role is passed, raise an exception
- Revoke direct EXECUTE access from all roles except `authenticator`
