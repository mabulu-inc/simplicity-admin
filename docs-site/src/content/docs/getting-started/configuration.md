---
title: Configuration
description: Configure SIMPLICITY-ADMIN via the config file, environment variables, and runtime overrides.
---

## Config File

Create `simplicity-admin.config.ts` at your project root:

```ts
import { defineConfig } from '@simplicity-admin/core';

export default defineConfig({
  database: process.env.DATABASE_URL,
  schema: 'public',
  port: 3000,
  basePath: '/admin',

  api: {
    graphql: true,
    rest: false,
    graphiql: true,
  },

  auth: {
    secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET,
    accessTokenTTL: '15m',
    refreshTokenTTL: '7d',
  },

  tenancy: {
    enabled: false,
    resolution: 'header',
    header: 'X-Tenant-ID',
  },

  providers: {},
  plugins: [],
});
```

## Key Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database` | `string` | **required** | PostgreSQL connection string |
| `schema` | `string` | `'public'` | Application schema to introspect |
| `port` | `number` | `3000` | Server port |
| `basePath` | `string` | `'/admin'` | URL base path for the admin UI |
| `api.graphql` | `boolean` | `true` | Enable GraphQL endpoint |
| `api.rest` | `boolean` | `false` | Enable REST adapter |
| `api.graphiql` | `boolean` | `true` | Enable GraphiQL explorer |
| `auth.secret` | `string` | **required** | JWT signing secret |
| `auth.accessTokenTTL` | `string` | `'15m'` | Access token time-to-live |
| `auth.refreshTokenTTL` | `string` | `'7d'` | Refresh token time-to-live |
| `tenancy.enabled` | `boolean` | `false` | Enable multi-tenancy |
| `tenancy.resolution` | `string` | `'header'` | How to resolve tenant ID |
| `tenancy.header` | `string` | `'X-Tenant-ID'` | Header name for tenant resolution |
| `providers` | `object` | `{}` | Custom provider overrides |
| `plugins` | `array` | `[]` | Plugin instances |

## Resolution Order

Configuration values resolve in this order, where later sources override earlier ones:

1. **Defaults** — Built-in sensible defaults
2. **Config file** — `simplicity-admin.config.ts`
3. **Environment variables** — `DATABASE_URL`, `SIMPLICITY_ADMIN_PORT`, etc.
4. **Runtime overrides** — Values passed directly to `createAdmin()`

```ts
// Runtime overrides take highest priority
app.use('/admin', createAdmin({
  database: process.env.DATABASE_URL,
  port: 4000, // Overrides config file and env var
}));
```

## Environment Variables

See the [Environment Variables reference](/reference/environment-variables/) for the complete list of supported variables.
