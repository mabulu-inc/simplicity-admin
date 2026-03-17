---
title: "@mabulu-inc/simplicity-admin-core"
description: Configuration, metadata model, provider interfaces, and plugin system.
---

The `core` package is the foundation of SIMPLICITY-ADMIN. It has zero dependencies on other `@simplicity-admin` packages and defines the contracts that every other package implements.

## Config System

Configuration is validated at startup using a Zod schema. Invalid configuration throws a descriptive error before any connections are made.

```ts
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';

export default defineConfig({
  database: process.env.DATABASE_URL,
  schema: 'public',
  port: 3000,
  basePath: '/admin',
  auth: {
    secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET,
    accessTokenTTL: '15m',
    refreshTokenTTL: '7d',
  },
});
```

`defineConfig()` provides type safety and validation. See the [Config Options reference](/reference/config-options/) for all available options.

## Metadata Model

The core package defines the metadata types that represent an introspected database schema:

- **`TableMeta`** — Table name, schema, columns, relations, primary key
- **`ColumnMeta`** — Column name, type, nullability, default, primary key flag
- **`RelationMeta`** — Foreign key relationship: local column, foreign table/column, cardinality
- **`EnumMeta`** — Enum name and allowed values

These types are used by every other package. The `db` package produces them via introspection; the `api`, `auth`, and `ui` packages consume them.

## Provider Interfaces and Registry

Each subsystem is defined by a provider interface:

```ts
interface DatabaseProvider { /* connect, introspect, disconnect */ }
interface APIProvider      { /* createEndpoints, middleware */ }
interface AuthProvider      { /* sign, verify, refresh, hashPassword, verifyPassword */ }
interface UIProvider        { /* serve */ }
```

Providers are registered in the config `providers` object. If a key is omitted, the built-in provider from the corresponding package is used.

```ts
export default defineConfig({
  database: process.env.DATABASE_URL,
  providers: {
    auth: myCustomAuthProvider,
  },
});
```

## Plugin System

Plugins hook into the SIMPLICITY-ADMIN lifecycle. They execute in the order they appear in the `plugins` array.

### Lifecycle Hooks

| Hook | When It Fires |
|------|--------------|
| `onInit` | After config is validated, before any connections |
| `onSchemaLoaded` | After introspection completes. Can transform the `SchemaMeta` |
| `onReady` | After all providers are initialized and the server is ready |
| `onRequest` | On every incoming HTTP request |
| `onShutdown` | On graceful server shutdown |

```ts
import type { Plugin } from '@mabulu-inc/simplicity-admin-core';

const myPlugin: Plugin = {
  name: 'my-plugin',
  onReady() {
    console.log('SIMPLICITY-ADMIN is ready');
  },
};

export default defineConfig({
  database: process.env.DATABASE_URL,
  plugins: [myPlugin],
});
```
