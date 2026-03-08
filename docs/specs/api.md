# API Module Specification

## Overview

The API module (`@simplicity-admin/api`) provides the auto-generated API layer. The default implementation uses PostGraphile V5 to generate a complete GraphQL API from PostgreSQL. An optional REST adapter provides RESTful endpoints from the same metadata. The API layer is swappable via the provider pattern.

## Package Location

- Package: `@simplicity-admin/api`
- Source: `packages/api/src/`
- Tests: `packages/api/tests/`

## Dependencies

- `@simplicity-admin/core` — provider interface, config types, metadata types
- `@simplicity-admin/db` — connection pool, metadata for PostGraphile configuration
- `postgraphile` — PostGraphile V5 (Graphile Crystal)
- `grafserv` — HTTP handler for PostGraphile V5

## Public API

### PostGraphile Provider

```typescript
// packages/api/src/provider.ts

export function postgraphileProvider(): APIProvider;
```

### PostGraphile Preset

```typescript
// packages/api/src/graphql/preset.ts

import type { GraphileConfig } from 'graphile-config';

export function createPreset(config: APIConfig, pool: ConnectionPool): GraphileConfig.Preset;
```

### pgSettings for RLS

```typescript
// packages/api/src/graphql/pg-settings.ts

export function createPgSettingsFromToken(payload: TokenPayload): Record<string, string>;
```

Returns:
```typescript
{
  'role': 'app_viewer',        // or app_editor, app_admin
  'app.user_id': '<uuid>',
  'app.tenant_id': '<uuid>',  // only if tenancy enabled
}
```

### REST Adapter (optional)

```typescript
// packages/api/src/rest/adapter.ts

export function createRESTHandler(pool: ConnectionPool, meta: SchemaMeta, config: APIConfig): HttpHandler;
```

### OpenAPI Generation

```typescript
// packages/api/src/rest/openapi.ts

export function generateOpenAPISpec(meta: SchemaMeta, config: APIConfig): OpenAPIDocument;
```

### API Server

```typescript
// packages/api/src/server.ts

export function createAPIServer(
  pool: ConnectionPool,
  meta: SchemaMeta,
  config: ProjectConfig
): Promise<HttpHandler>;
```

This is the main entry point. It:
1. Creates the PostGraphile preset from config + pool
2. Optionally creates the REST adapter
3. Returns an HTTP handler that routes to the appropriate API

## Behavior Specification

### B-API-001: PostGraphile Preset Creation
**Given** a valid `APIConfig` and connection pool
**When** `createPreset(config, pool)` is called
**Then** returns a PostGraphile V5 preset configured for the target schema

### B-API-002: GraphQL Endpoint
**Given** an API server created with default config
**When** a POST request is sent to `/api/graphql` with a valid GraphQL query
**Then** returns a JSON response with the query results

### B-API-003: GraphQL Introspection
**Given** an API server with `graphiql: true` (default in dev)
**When** a GET request is sent to `/api/graphql`
**Then** serves the GraphiQL IDE

### B-API-004: GraphQL — List Query
**Given** a table `contacts` with 3 rows
**When** a GraphQL query `{ allContacts { nodes { id, name } } }` is executed
**Then** returns all 3 contacts with id and name fields

### B-API-005: GraphQL — Pagination
**Given** a table with 100 rows
**When** a query with `first: 10, offset: 20` is executed
**Then** returns rows 21-30

### B-API-006: GraphQL — Filtering
**Given** contacts with statuses 'active' and 'inactive'
**When** a query with `condition: { status: "active" }` is executed
**Then** returns only active contacts

### B-API-007: GraphQL — Sorting
**Given** contacts with various names
**When** a query with `orderBy: NAME_ASC` is executed
**Then** returns contacts sorted alphabetically by name

### B-API-008: GraphQL — Create Mutation
**Given** a table `contacts`
**When** a `createContact(input: { name: "Alice" })` mutation is executed
**Then** inserts the record and returns the created contact

### B-API-009: GraphQL — Update Mutation
**Given** an existing contact with id X
**When** `updateContactById(input: { id: X, patch: { name: "Bob" } })` is executed
**Then** updates the name and returns the updated contact

### B-API-010: GraphQL — Delete Mutation
**Given** an existing contact with id X
**When** `deleteContactById(input: { id: X })` is executed
**Then** deletes the record and returns the deleted contact

### B-API-011: pgSettings — Auth Context
**Given** a JWT payload with `userId: "abc", role: "app_editor", tenantId: "xyz"`
**When** `createPgSettingsFromToken(payload)` is called
**Then** returns `{ role: 'app_editor', 'app.user_id': 'abc', 'app.tenant_id': 'xyz' }`

### B-API-012: pgSettings — No Tenant
**Given** a JWT payload with `userId: "abc", role: "app_viewer"` (no tenantId)
**When** `createPgSettingsFromToken(payload)` is called
**Then** returns `{ role: 'app_viewer', 'app.user_id': 'abc' }` (no tenant setting)

### B-API-013: GraphQL Disabled
**Given** config with `api.graphql: false`
**When** `createAPIServer()` is called
**Then** the GraphQL endpoint is NOT mounted (POST to /api/graphql returns 404)

### B-API-014: REST Enabled
**Given** config with `api.rest: '/api/rest'`
**When** `createAPIServer()` is called
**Then** REST endpoints are available at /api/rest/:table

### B-API-015: REST — List
**Given** REST is enabled and table `contacts` exists with rows
**When** `GET /api/rest/contacts` is requested
**Then** returns JSON array of contacts with pagination metadata

### B-API-016: REST — Single Record
**Given** REST is enabled and contact with id X exists
**When** `GET /api/rest/contacts/X` is requested
**Then** returns the single contact as JSON

### B-API-017: REST — Create
**Given** REST is enabled
**When** `POST /api/rest/contacts` with JSON body `{ name: "Alice" }` is requested
**Then** creates the contact and returns 201 with the created record

### B-API-018: REST — Update
**Given** REST is enabled and contact with id X exists
**When** `PATCH /api/rest/contacts/X` with JSON body `{ name: "Bob" }` is requested
**Then** updates the contact and returns 200 with the updated record

### B-API-019: REST — Delete
**Given** REST is enabled and contact with id X exists
**When** `DELETE /api/rest/contacts/X` is requested
**Then** deletes the contact and returns 200 with the deleted record

### B-API-020: REST — OpenAPI Spec
**Given** REST is enabled
**When** `GET /api/rest/openapi.json` is requested
**Then** returns a valid OpenAPI 3.0 document describing all endpoints

### B-API-021: RLS Enforcement via pgSettings
**Given** a user with role `app_viewer` in tenant T and RLS enabled on contacts
**When** they query contacts via GraphQL
**Then** only contacts with `tenant_id = T` are returned (RLS policy enforced)

### Actions API

### B-API-022: Actions — Row Annotation
**Given** table `orders` has actions `approve` (condition: `status === 'pending'`) and `cancel` (always available)
**When** a list query returns an order with `status: 'pending'`
**Then** the row includes `_actions: ['approve', 'cancel']` — evaluated server-side per row

### B-API-023: Actions — Execute
**Given** action `approve` is defined on `orders`
**When** POST `/api/actions/orders/approve` with body `{ ids: ['<order-id>'] }`
**Then** the server re-checks the condition and RBAC, runs the action handler, and returns the `ActionResult`

### B-API-024: Actions — Execute Bulk
**Given** action `archive` with `bulk: true` is defined on `projects`
**When** POST `/api/actions/projects/archive` with body `{ ids: ['<id1>', '<id2>', '<id3>'] }`
**Then** the server loads all 3 rows, checks conditions for each, runs the handler with all qualifying rows

### B-API-025: Actions — Condition Failed (409)
**Given** order was `pending` when the page loaded, but has since been shipped
**When** POST `/api/actions/orders/approve` with body `{ ids: ['<order-id>'] }`
**Then** responds with 409 and `{ error: "Action 'approve' is no longer available for this record" }`

### B-API-026: Actions — RBAC Check
**Given** action `delete_batch` on `contacts` with `roles: ['app_admin']`
**When** a user with `activeRole: 'app_editor'` calls POST `/api/actions/contacts/delete_batch`
**Then** responds with 403 and `{ error: "Insufficient permissions for this action" }`

### B-API-027: Actions — Unknown Action (404)
**Given** no action `foo` is defined on `contacts`
**When** POST `/api/actions/contacts/foo`
**Then** responds with 404 and `{ error: "Unknown action 'foo' on table 'contacts'" }`

### B-API-028: Actions — Metadata Endpoint
**Given** table `orders` has actions `approve`, `cancel`, and `export_pdf`
**When** GET `/api/actions/orders`
**Then** returns action metadata (name, label, icon, variant, bulk, placement, confirm) for the current user's role — excludes actions the user's role cannot access

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| PostGraphile startup failed | APIError | API_001 | Throw with PostGraphile error details |
| Invalid GraphQL query | — | — | PostGraphile returns standard GraphQL errors |
| REST endpoint for non-existent table | APIError | API_002 | Return 404 with `{ error: "Table not found" }` |
| REST record not found | APIError | API_003 | Return 404 with `{ error: "Record not found" }` |
| Unknown action | ActionError | API_004 | Return 404 with action and table name |
| Action condition not met | ActionError | API_005 | Return 409 Conflict |
| Action RBAC denied | ActionError | API_006 | Return 403 |
| Action handler failure | ActionError | API_007 | Return 500, log error |

## Security Considerations

- GraphiQL must be disabled in production (`graphiql: false` when NODE_ENV=production)
- All API endpoints must pass through auth middleware (except explicitly public routes)
- pgSettings must always be set from the verified JWT payload, never from request parameters
- REST responses must not leak internal column names that the user's role cannot SELECT (column-level RBAC)

## Test Requirements

### Unit Tests
- [ ] `createPgSettingsFromToken()` maps payload to correct pgSettings
- [ ] `createPgSettingsFromToken()` omits tenant when not present
- [ ] `generateOpenAPISpec()` produces valid OpenAPI 3.0 document
- [ ] `generateOpenAPISpec()` includes all tables from metadata
- [ ] `createPreset()` produces valid PostGraphile preset

### Integration Tests (require real Postgres + PostGraphile)
- [ ] GraphQL query returns data from database
- [ ] GraphQL mutation creates record
- [ ] GraphQL mutation updates record
- [ ] GraphQL mutation deletes record
- [ ] GraphQL pagination works (first, offset)
- [ ] GraphQL filtering works (condition)
- [ ] GraphQL sorting works (orderBy)
- [ ] GraphQL respects RLS policies (tenant isolation)
- [ ] REST list endpoint returns records with pagination
- [ ] REST single record endpoint returns correct record
- [ ] REST create returns 201 with created record
- [ ] REST update returns 200 with updated record
- [ ] REST delete returns 200 with deleted record
- [ ] REST 404 for non-existent table
- [ ] REST 404 for non-existent record
- [ ] API server respects `api.graphql: false` (no GraphQL endpoint)
- [ ] API server respects `api.rest: '/api/rest'` (REST enabled)
- [ ] Action row annotation includes correct `_actions` per row
- [ ] Action execution runs handler and returns result
- [ ] Action execution re-checks condition before running (409 on stale)
- [ ] Action execution checks RBAC (403 for unauthorized role)
- [ ] Action bulk execution passes multiple rows to handler
- [ ] Action metadata endpoint returns actions filtered by role
- [ ] Unknown action returns 404

## File Manifest

```
packages/api/
  src/
    index.ts                    # Public API re-exports
    provider.ts                 # postgraphileProvider() default implementation
    server.ts                   # createAPIServer() orchestrator
    graphql/
      preset.ts                 # PostGraphile V5 preset configuration
      plugins/                  # Custom Graphile plugins (as needed)
      pg-settings.ts            # JWT → pgSettings mapper
    rest/
      adapter.ts                # REST API handler
      openapi.ts                # OpenAPI spec generator
    actions/
      handler.ts                # POST /api/actions/:table/:action
      metadata.ts               # GET /api/actions/:table (action metadata for UI)
      annotator.ts              # Evaluates conditions, adds _actions to rows
  tests/
    pg-settings.test.ts         # Unit tests for pgSettings mapping
    graphql.test.ts             # Integration tests for GraphQL
    rest.test.ts                # Integration tests for REST
    server.test.ts              # Integration tests for API server
  package.json
  tsconfig.json
```

## Decision References

- ADR-002: PostGraphile V5 as default GraphQL provider, REST as optional adapter
- ADR-006: Provider pattern — postgraphileProvider() is the default APIProvider
