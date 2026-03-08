# ADR-006: Provider Pattern for Swappable Defaults

## Status
Accepted

## Context
A core design principle is: "Every default is swappable via the provider pattern." The framework ships with excellent defaults (PostgreSQL, PostGraphile, JWT, SvelteKit) but must allow developers to replace any layer without touching the rest of the system.

Options considered:
1. Dependency Injection container (like InversifyJS, tsyringe)
2. Plugin-based architecture (like Fastify plugins)
3. Provider pattern (interfaces in core, implementations in packages, registered via config)

## Decision
**Provider pattern with config-based registration.** No DI container.

### Design:

1. **Interfaces live in `@simplicity-admin/core`**: Each swappable capability is defined as a TypeScript interface (`DatabaseProvider`, `APIProvider`, `AuthProvider`, `UIProvider`).

2. **Default implementations live in their own packages**: `@simplicity-admin/db` exports `postgresProvider()`, `@simplicity-admin/api` exports `postgraphileProvider()`, etc.

3. **Registration via config object**:
```typescript
export default defineConfig({
  database: process.env.DATABASE_URL,
  providers: {
    database: postgresProvider(),    // default — auto-registered if omitted
    api: postgraphileProvider(),     // default — auto-registered if omitted
    auth: jwtProvider(),             // default — auto-registered if omitted
  },
});
```

4. **Resolution via `ProviderRegistry`**: The core engine creates a `ProviderRegistry`, registers all providers (explicit or default), and passes it to modules that need it.

### Why not DI?
- DI containers add complexity and magic (string-based or decorator-based resolution)
- Config-based registration is explicit and debuggable
- TypeScript interfaces provide compile-time type safety
- The framework has a small, fixed number of provider types (not an open-ended plugin system)

### Why not just plugins?
- Plugins are for extending behavior (hooks, middleware). Providers are for replacing behavior.
- The distinction matters: you want exactly ONE database provider, but you can have MANY plugins.
- Providers have lifecycle methods (init, shutdown) managed by the registry.

## Consequences
**Positive:**
- Explicit and debuggable — no magic, no decorators, no reflection
- TypeScript interface provides clear contract for custom implementations
- Config file is the single source of truth for which providers are in use
- Default providers auto-register when omitted (zero-config experience)

**Negative:**
- Fixed provider types (adding a new provider type requires changes to core)
- No dependency resolution between providers (providers must be independent)
- Cannot swap providers at runtime (only at startup via config)

**Risks:**
- Provider interfaces must be stable — breaking changes affect all custom implementations
- Adding too many provider types could make the interface unwieldy (keep it minimal)
