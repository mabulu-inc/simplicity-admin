---
title: Architecture
description: The provider pattern, package dependency graph, and how the three consumption modes converge.
---

## Provider Pattern

Every major subsystem in SIMPLICITY-ADMIN is defined by a provider interface in the `core` package. This lets you swap any layer without affecting the rest.

### Provider Interfaces

```ts
interface DatabaseProvider {
  connect(): Promise<void>;
  introspect(): Promise<SchemaMeta>;
  disconnect(): Promise<void>;
}

interface APIProvider {
  createEndpoints(schema: SchemaMeta): void;
  middleware(): RequestHandler;
}

interface AuthProvider {
  sign(payload: object): string;
  verify(token: string): object;
  refresh(token: string): string;
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
}

interface UIProvider {
  serve(): RequestHandler;
}
```

Each built-in package (`@simplicity-admin/db`, `@simplicity-admin/api`, `@simplicity-admin/auth`, `@simplicity-admin/ui`) implements one of these interfaces. To replace a subsystem, implement the interface and register it in your config's `providers` object.

## Package Dependency Graph

```
@simplicity-admin/core          (zero dependencies on other @simplicity-admin packages)
  |
  +-- @simplicity-admin/db      (depends on core + simplicity-schema)
  |     |
  |     +-- @simplicity-admin/api   (depends on core + db)
  |     |
  |     +-- @simplicity-admin/auth  (depends on core + db)
  |
  +-- @simplicity-admin/ui      (depends on core only)
  |
  +-- @simplicity-admin/cli     (depends on all other packages)
```

**Key design rule:** `core` has zero dependencies on other `@simplicity-admin` packages. It defines interfaces, configuration, and the metadata model. Everything else depends on `core`.

## Three Modes, One Engine

All three consumption modes — CLI scaffold, npm install, embeddable middleware — converge on the same core engine:

1. **CLI scaffold** — The `init` command generates a project that imports and wires the packages together.
2. **npm install** — You import the packages directly and use `defineConfig()` to configure them.
3. **Embeddable middleware** — `createAdmin()` wires the packages internally and returns standard HTTP middleware.

Regardless of how you consume SIMPLICITY-ADMIN, the startup sequence is identical:

1. Load and validate configuration (Zod schema)
2. Register providers (built-in or custom)
3. Connect to the database
4. Introspect the schema
5. Initialize API, auth, and UI layers
6. Execute plugin lifecycle hooks
7. Serve

## Next Steps

- [Schema-as-Truth](/core-concepts/schema-as-truth/) — How database introspection drives the entire system
- [Core Package](/packages/core/) — Detailed look at the config system, metadata model, and plugin hooks
