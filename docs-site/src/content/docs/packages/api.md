---
title: "@simplicity-admin/api"
description: PostGraphile V5 GraphQL API with optional REST adapter.
---

The `api` package implements the `APIProvider` interface from `core`. It uses PostGraphile V5 to auto-generate a GraphQL API from the introspected database schema.

**Dependencies:** `@simplicity-admin/core`, `@simplicity-admin/db`

## GraphQL API

PostGraphile V5 generates a complete GraphQL schema from your PostgreSQL tables, including:

- **Queries** — Fetch single records, list records with filtering/ordering/pagination
- **Mutations** — Create, update, and delete records
- **Subscriptions** — Real-time updates via WebSocket

### Example Query

```graphql
query {
  products(
    first: 10
    orderBy: CREATED_AT_DESC
    filter: { status: { equalTo: ACTIVE } }
  ) {
    nodes {
      id
      name
      category {
        name
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Pagination

All list queries use Relay cursor-based pagination with `first`, `after`, `last`, and `before` arguments. The `pageInfo` object includes `hasNextPage`, `hasPreviousPage`, `startCursor`, and `endCursor`.

### Filtering and Ordering

PostGraphile generates filter types for each table. Filter operators include `equalTo`, `notEqualTo`, `greaterThan`, `lessThan`, `in`, `like`, and more, depending on column type.

Ordering is available on all columns via generated `OrderBy` enums (e.g., `NAME_ASC`, `CREATED_AT_DESC`).

## RLS Integration

On each request, the `api` package sets `pgSettings` on the database connection based on the authenticated user:

```ts
{
  'role': 'app_editor',
  'simplicity.user_id': '550e8400-e29b-41d4-a716-446655440000'
}
```

PostgreSQL RLS policies reference these settings to filter rows. This means security is enforced at the database level, not in application code.

## GraphiQL Explorer

When `api.graphiql` is enabled (default: `true`), a GraphiQL IDE is available at `{basePath}/graphiql` for exploring and testing queries.

## Optional REST Adapter

When `api.rest` is enabled, the `api` package generates RESTful endpoints with an OpenAPI specification:

```ts
export default defineConfig({
  database: process.env.DATABASE_URL,
  api: {
    rest: true,
  },
});
```

REST endpoints follow standard conventions:

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/{table}` | List records |
| `GET` | `/api/{table}/:id` | Get single record |
| `POST` | `/api/{table}` | Create record |
| `PATCH` | `/api/{table}/:id` | Update record |
| `DELETE` | `/api/{table}/:id` | Delete record |

The OpenAPI spec is available at `/api/openapi.json`.
