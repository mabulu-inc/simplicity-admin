# ADR-002: PostGraphile V5 as Default GraphQL Provider

## Status
Accepted

## Context
The framework auto-generates an API from the database schema. Options considered:
1. Build a custom GraphQL schema generator from DB metadata
2. Use PostGraphile V5 (Graphile Crystal) as the default provider
3. Use Hasura as the GraphQL engine

PostGraphile V5 generates a complete, spec-compliant GraphQL API from PostgreSQL with zero code. It handles queries, mutations, pagination, filtering, ordering, relations, and subscriptions. It deeply integrates with PostgreSQL features (RLS, grants, functions) for security enforcement.

## Decision
**PostGraphile V5 as the default `APIProvider`.** PostGraphile is configured via a custom preset in `@simplicity-admin/api`. The framework adds a thin layer:
- Custom Graphile preset for framework-specific configuration
- pgSettings mapper (JWT payload → PostgreSQL session settings for RLS)
- Optional REST adapter that generates RESTful endpoints from the same metadata

The API provider is swappable via the provider pattern. Developers who need a different GraphQL implementation or a REST-only API can replace the default.

GraphQL is the default API. REST is optional and disabled by default. Configuration:
```typescript
api: {
  graphql: '/api/graphql',  // string = enabled at path, false = disabled
  rest: false,               // string = enabled at path, false = disabled
}
```

## Consequences
**Positive:**
- Complete GraphQL API with zero application code
- Deep PostgreSQL integration (RLS, grants enforced at query level)
- Battle-tested, actively maintained, excellent performance
- Subscriptions for real-time updates
- Plugin system for extending schema without forking

**Negative:**
- PostGraphile is a significant dependency (though V5 is more modular)
- PostGraphile's plugin API has a learning curve
- Tight coupling to PostgreSQL (reinforces ADR-001)

**Risks:**
- PostGraphile major version changes could require significant migration
- The REST adapter is a separate implementation that must be kept in sync with the metadata model
