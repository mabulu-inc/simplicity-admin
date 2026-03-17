---
title: Writing Plugins
description: Create plugins that hook into the SIMPLICITY-ADMIN lifecycle.
---

Plugins let you extend SIMPLICITY-ADMIN by hooking into lifecycle events. A plugin is an object that implements one or more lifecycle hooks.

## Plugin Interface

```ts
import type { Plugin } from '@simplicity-admin/core';

const myPlugin: Plugin = {
  name: 'my-plugin',
  onInit(config) { /* ... */ },
  onSchemaLoaded(schema) { /* ... */ },
  onReady() { /* ... */ },
  onRequest(req, res) { /* ... */ },
  onShutdown() { /* ... */ },
};
```

All hooks are optional. Implement only the ones you need.

## Lifecycle Hooks

### `onInit(config)`

Fires after configuration is validated, before any database connections. Receives the resolved config object. Use this for early setup or config validation.

### `onSchemaLoaded(schema)`

Fires after database introspection completes. Receives the `SchemaMeta` object. You can transform the metadata here — add computed columns, hide tables, modify relations. Return the modified schema to pass it downstream.

```ts
onSchemaLoaded(schema) {
  // Hide internal tables from the admin UI
  schema.tables = schema.tables.filter(t => !t.name.startsWith('_internal'));
  return schema;
},
```

### `onReady()`

Fires after all providers are initialized and the server is ready to accept requests. Use this for startup notifications, health check registration, or warm-up tasks.

### `onRequest(req, res)`

Fires on every incoming HTTP request. Receives the request and response objects. Use this for logging, metrics, or request-level middleware.

### `onShutdown()`

Fires on graceful server shutdown. Use this to close external connections, flush buffers, or send shutdown notifications.

## Example: Request Logger Plugin

```ts
import type { Plugin } from '@simplicity-admin/core';

export function requestLogger(): Plugin {
  return {
    name: 'request-logger',
    onRequest(req) {
      const start = Date.now();
      req.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
      });
    },
  };
}
```

## Registering Plugins

Add plugins to the `plugins` array in your config. Plugins execute in array order:

```ts
import { defineConfig } from '@simplicity-admin/core';
import { requestLogger } from './plugins/request-logger';
import { auditTrail } from './plugins/audit-trail';

export default defineConfig({
  database: process.env.DATABASE_URL,
  plugins: [
    requestLogger(),
    auditTrail(),
  ],
});
```

## Execution Order

When multiple plugins implement the same hook, they execute in the order they appear in the `plugins` array. For `onSchemaLoaded`, each plugin receives the schema returned by the previous plugin, forming a transformation pipeline.
