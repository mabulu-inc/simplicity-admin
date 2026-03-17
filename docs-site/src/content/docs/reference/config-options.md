---
title: Config Options Reference
description: Complete reference of all ProjectConfig options with types, defaults, and descriptions.
---

All options for `simplicity-admin.config.ts`. Pass these to `defineConfig()` or `createAdmin()`.

## Top-Level Options

### `database`

- **Type:** `string`
- **Default:** none (required)
- **Description:** PostgreSQL connection string.

```ts
database: 'postgres://user:password@localhost:5432/mydb'
```

### `schema`

- **Type:** `string`
- **Default:** `'public'`
- **Description:** The PostgreSQL schema to introspect for application tables.

### `systemSchema`

- **Type:** `string`
- **Default:** `'_simplicity'`
- **Description:** Schema name for SIMPLICITY-ADMIN internal tables (users, sessions, roles, audit log).

### `port`

- **Type:** `number`
- **Default:** `3000`
- **Description:** Server port. Only used in standalone mode (not when embedded as middleware).

### `basePath`

- **Type:** `string`
- **Default:** `'/admin'`
- **Description:** URL base path for the admin UI and all API routes.

## `api`

### `api.graphql`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable the GraphQL endpoint at `{basePath}/graphql`.

### `api.rest`

- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable RESTful endpoints at `{basePath}/api/{table}` with OpenAPI spec.

### `api.graphiql`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable the GraphiQL explorer at `{basePath}/graphiql`.

## `auth`

### `auth.secret`

- **Type:** `string`
- **Default:** none (required)
- **Description:** Secret key for signing and verifying JWTs. Use a strong random value in production.

### `auth.accessTokenTTL`

- **Type:** `string`
- **Default:** `'15m'`
- **Description:** Access token time-to-live. Accepts shorthand durations: `'15m'`, `'1h'`, `'1d'`.

### `auth.refreshTokenTTL`

- **Type:** `string`
- **Default:** `'7d'`
- **Description:** Refresh token time-to-live.

## `tenancy`

### `tenancy.enabled`

- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable multi-tenancy support.

### `tenancy.resolution`

- **Type:** `string`
- **Default:** `'header'`
- **Description:** How the tenant ID is resolved from incoming requests.

### `tenancy.header`

- **Type:** `string`
- **Default:** `'X-Tenant-ID'`
- **Description:** HTTP header name used for tenant resolution when `tenancy.resolution` is `'header'`.

## `providers`

- **Type:** `object`
- **Default:** `{}`
- **Description:** Custom provider overrides. Keys: `database`, `api`, `auth`, `ui`. Values must implement the corresponding provider interface from `@mabulu-inc/simplicity-admin-core`.

```ts
providers: {
  auth: myCustomAuthProvider,
}
```

## `plugins`

- **Type:** `Plugin[]`
- **Default:** `[]`
- **Description:** Array of plugin instances. Plugins execute lifecycle hooks in array order.

```ts
plugins: [requestLogger(), auditTrail()]
```
