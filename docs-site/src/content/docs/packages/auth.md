---
title: "@simplicity-admin/auth"
description: JWT authentication, bcrypt password hashing, and the RBAC engine.
---

The `auth` package implements the `AuthProvider` interface from `core`. It handles authentication (JWT tokens, password hashing) and authorization (role-based permission resolution).

**Dependencies:** `@simplicity-admin/core`, `@simplicity-admin/db`

## JWT Authentication

### Token Lifecycle

1. **Login** — User submits email and password. On success, the server returns an access token and a refresh token.
2. **Access** — The access token is sent with each request. Short-lived (default: 15 minutes).
3. **Refresh** — When the access token expires, the client sends the refresh token to obtain a new access token. Refresh tokens are longer-lived (default: 7 days).
4. **Logout** — The refresh token is revoked server-side.

### Configuration

```ts
export default defineConfig({
  database: process.env.DATABASE_URL,
  auth: {
    secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET,
    accessTokenTTL: '15m',
    refreshTokenTTL: '7d',
  },
});
```

The `secret` is required and used for signing and verifying JWTs. Use a strong, random value in production.

## Password Hashing

Passwords are hashed with bcrypt at a cost factor of 12 or higher. Plain-text passwords are never stored or logged.

## Auth Routes

The `auth` package registers these routes under the configured `basePath`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Authenticate with email and password |
| `POST` | `/auth/logout` | Revoke the refresh token |
| `POST` | `/auth/refresh` | Exchange a refresh token for a new access token |

## Auth Middleware

Every request to the admin panel passes through the auth middleware. It:

1. Extracts the JWT from the `Authorization` header
2. Verifies the token signature and expiration
3. Resolves the user's roles and permissions
4. Sets `pgSettings` on the database connection for RLS enforcement

Unauthenticated requests receive the `anon` role.

## RBAC Engine

The RBAC engine merges code-defined permissions (from simplicity-schema grants) with database-stored permission overrides. Code permissions set the ceiling; database overrides can only restrict further.

Permission resolution for a request:

1. Load the user's assigned roles
2. For each role, load code-defined grants
3. Apply any database-stored restrictions
4. Merge all role permissions (union)
5. Cache the resolved permission set for the request lifetime

See [Role-Based Access Control](/core-concepts/rbac/) for the full model.
