---
title: Embedding in an Existing App
description: Mount SIMPLICITY-ADMIN as middleware in any Node.js HTTP framework.
---

SIMPLICITY-ADMIN can run as middleware inside your existing Node.js application. Use `createAdmin()` to get a request handler that you mount at any path.

## Express

```ts
import express from 'express';
import { createAdmin } from '@simplicity-admin/core';

const app = express();

app.use('/admin', createAdmin({
  database: process.env.DATABASE_URL,
  auth: {
    secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET,
  },
}));

// Your existing routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('App running on http://localhost:3000');
  console.log('Admin panel at http://localhost:3000/admin');
});
```

## Fastify

```ts
import Fastify from 'fastify';
import middie from '@fastify/middie';
import { createAdmin } from '@simplicity-admin/core';

const fastify = Fastify();

await fastify.register(middie);
fastify.use('/admin', createAdmin({
  database: process.env.DATABASE_URL,
  auth: {
    secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET,
  },
}));

fastify.get('/api/health', async () => ({ status: 'ok' }));

fastify.listen({ port: 3000 });
```

## How It Works

`createAdmin()` returns standard Node.js HTTP middleware compatible with any framework that supports the `(req, res, next)` signature. Internally it:

1. Loads and validates the provided configuration
2. Connects to the database and introspects the schema
3. Initializes all providers (API, auth, UI)
4. Returns a middleware function that routes requests to the appropriate provider

All SIMPLICITY-ADMIN routes (UI, GraphQL, auth endpoints) are scoped under the mount path. If you mount at `/admin`:

| Path | Handler |
|------|---------|
| `/admin` | SvelteKit admin UI |
| `/admin/graphql` | GraphQL endpoint |
| `/admin/graphiql` | GraphiQL explorer |
| `/admin/auth/login` | Login endpoint |
| `/admin/auth/logout` | Logout endpoint |
| `/admin/auth/refresh` | Token refresh endpoint |

## Configuration

`createAdmin()` accepts the same options as `defineConfig()`. The `basePath` option is automatically set to your mount path, so you do not need to specify it.

```ts
app.use('/my-custom-path', createAdmin({
  database: process.env.DATABASE_URL,
  // basePath is automatically '/my-custom-path'
}));
```

All configuration resolution rules apply: defaults, then config file values, then environment variables, then the options passed to `createAdmin()`.
