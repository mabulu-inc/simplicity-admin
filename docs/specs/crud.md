# CRUD Module Specification

## Overview

The CRUD module provides auto-generated list views, detail views, and forms driven by the database metadata model. It is not a separate package — CRUD functionality is implemented as SvelteKit routes in `@simplicity-admin/ui` that consume `SchemaMeta` from the API. This spec defines the data flow and component behavior.

## Package Location

- Source: `packages/ui/src/routes/(app)/[table]/`
- Components: `packages/ui/src/lib/components/`
- Tests: `packages/ui/tests/crud/`

## Dependencies

- `@simplicity-admin/core` — metadata types (TableMeta, ColumnMeta, RelationMeta)
- `@simplicity-admin/ui` — DataTable, AutoForm, Shell components
- GraphQL API (via HTTP) — all data operations go through the API layer

## Public API

### Route Structure

```
/admin/[table]              → List view (DataTable)
/admin/[table]/new          → Create form (AutoForm in create mode)
/admin/[table]/[id]         → Detail/edit view (AutoForm in edit mode)
```

### Server-Side Data Loading

```typescript
// packages/ui/src/routes/(app)/[table]/+page.server.ts

export interface ListPageData {
  table: TableMeta;
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, unknown>;
}

export const load: PageServerLoad = async ({ params, url, locals }) => ListPageData;
```

```typescript
// packages/ui/src/routes/(app)/[table]/[id]/+page.server.ts

export interface DetailPageData {
  table: TableMeta;
  record: Record<string, unknown>;
  relations: { table: string; rows: Record<string, unknown>[] }[];
}

export const load: PageServerLoad = async ({ params, locals }) => DetailPageData;
```

### GraphQL Query Generation

```typescript
// packages/ui/src/lib/graphql/query-builder.ts

export function buildListQuery(table: TableMeta, options: ListOptions): string;
export function buildDetailQuery(table: TableMeta, relations: RelationMeta[]): string;
export function buildCreateMutation(table: TableMeta): string;
export function buildUpdateMutation(table: TableMeta): string;
export function buildDeleteMutation(table: TableMeta): string;

export interface ListOptions {
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, unknown>;
}
```

## Behavior Specification

### B-CRUD-001: List View — Auto-Generated
**Given** a table `contacts` with columns `id`, `first_name`, `last_name`, `email`
**When** user navigates to `/admin/contacts`
**Then** a DataTable renders with column headers matching the table columns and rows from the database

### B-CRUD-002: List View — Pagination
**Given** 50 contacts exist and page size is 25 (default)
**When** user views `/admin/contacts`
**Then** 25 rows are displayed with pagination controls showing "Page 1 of 2"

### B-CRUD-003: List View — Page Navigation
**Given** user is on page 1 of contacts (50 total, 25 per page)
**When** user clicks "Next" or page 2
**Then** rows 26-50 are displayed

### B-CRUD-004: List View — Column Sorting
**Given** contacts list is displayed
**When** user clicks the "Last Name" column header
**Then** rows are sorted by last_name ascending; clicking again reverses to descending

### B-CRUD-005: List View — Filtering
**Given** contacts list with a filter bar
**When** user types "alice" in the search/filter input
**Then** only contacts matching "alice" in any text column are displayed

### B-CRUD-006: List View — FK Display
**Given** `deals` table with `contact_id` (FK to contacts)
**When** user views `/admin/deals`
**Then** the contact_id column displays the contact's display name (e.g., "Alice Smith"), not the raw UUID

### B-CRUD-007: List View — Empty State
**Given** table `products` has zero rows
**When** user views `/admin/products`
**Then** a "No records yet" message is shown with a "Create" button

### B-CRUD-008: List View — RBAC Column Filtering
**Given** user has role `app_viewer` which cannot SELECT the `salary` column
**When** user views `/admin/contacts`
**Then** the `salary` column is NOT rendered in the DataTable

### B-CRUD-009: Create — Form Generation
**Given** table `contacts` with columns of various types
**When** user navigates to `/admin/contacts/new`
**Then** AutoForm renders appropriate inputs for each column (text→TextInput, boolean→Toggle, enum→Select, FK→RelationPicker, date→DatePicker)

### B-CRUD-010: Create — Required Validation
**Given** `first_name` is NOT NULL (required)
**When** user submits the form without filling `first_name`
**Then** form shows validation error on the field and does NOT submit

### B-CRUD-011: Create — Successful Submit
**Given** user fills all required fields
**When** user clicks "Save"
**Then** a GraphQL create mutation is sent, record is created, toast notification shows "Created", and user is redirected to the list view

### B-CRUD-012: Create — RBAC Field Filtering
**Given** user has role `app_editor` which cannot INSERT the `salary` column
**When** user views `/admin/contacts/new`
**Then** the `salary` field is NOT rendered in the create form

### B-CRUD-013: Edit — Load Existing Record
**Given** a contact with id X exists
**When** user navigates to `/admin/contacts/X`
**Then** AutoForm renders with all fields populated with the current values

### B-CRUD-014: Edit — Partial Update
**Given** user changes only the `email` field
**When** user clicks "Save"
**Then** a GraphQL update mutation is sent with only the changed field, and a toast shows "Updated"

### B-CRUD-015: Edit — RBAC Read-Only Fields
**Given** user has role `app_editor` with SELECT but no UPDATE on `created_at`
**When** user views the edit form
**Then** `created_at` is displayed but disabled/read-only

### B-CRUD-016: Delete — Confirmation
**Given** user is viewing a contact record
**When** user clicks "Delete"
**Then** a confirmation dialog appears: "Are you sure you want to delete this record?"

### B-CRUD-017: Delete — Successful
**Given** user confirms deletion
**When** the delete mutation executes
**Then** record is deleted, toast shows "Deleted", user is redirected to list view

### B-CRUD-018: Delete — FK Constraint Error
**Given** a contact is referenced by deals (FK constraint)
**When** user tries to delete the contact
**Then** an error message is shown: "Cannot delete: this record is referenced by other records"

### B-CRUD-019: GraphQL Query Builder — List
**Given** table `contacts` with columns `id, name, email`
**When** `buildListQuery(contactsMeta, { page: 1, pageSize: 25 })` is called
**Then** returns a valid GraphQL query string for fetching paginated contacts

### B-CRUD-020: GraphQL Query Builder — Mutations
**Given** table `contacts`
**When** `buildCreateMutation(contactsMeta)` is called
**Then** returns a valid GraphQL mutation string for creating a contact

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Table not found in metadata | — | — | 404 page: "Table not found" |
| Record not found | — | — | 404 page: "Record not found" |
| Validation error (required field) | — | — | Inline form error on the field |
| GraphQL mutation error | — | — | Toast notification with error message |
| FK constraint on delete | — | — | Toast with "Cannot delete: referenced by other records" |
| Permission denied | — | — | Toast with "Permission denied" (should be rare — UI hides unauthorized actions) |

## Security Considerations

- RBAC filtering happens server-side (in +page.server.ts) NOT client-side. The server reads effective permissions and only includes accessible columns in the GraphQL query.
- FK display names must not leak data from tables the user cannot access (use the API which enforces RLS).
- Delete confirmation prevents accidental data loss.
- All form submissions go through the GraphQL API which enforces RLS and grants.

## Test Requirements

### Unit Tests
- [ ] `buildListQuery()` produces valid GraphQL for various table shapes
- [ ] `buildDetailQuery()` includes relation fields
- [ ] `buildCreateMutation()` produces valid GraphQL
- [ ] `buildUpdateMutation()` produces valid GraphQL
- [ ] `buildDeleteMutation()` produces valid GraphQL
- [ ] Query builder handles tables with no relations
- [ ] Query builder handles enum columns correctly
- [ ] Query builder respects column filtering (RBAC — only requested columns)

### E2E Tests (Playwright)
- [ ] List view renders for a table with data
- [ ] List view pagination works (next/prev)
- [ ] List view sorting works (click column header)
- [ ] List view shows empty state for empty table
- [ ] Create form renders appropriate inputs for each column type
- [ ] Create form validates required fields
- [ ] Create form submits and creates record
- [ ] Edit form loads with existing values
- [ ] Edit form submits partial update
- [ ] Delete shows confirmation dialog
- [ ] Delete removes record and redirects to list
- [ ] FK columns display related record names

## File Manifest

```
packages/ui/
  src/
    lib/
      graphql/
        query-builder.ts        # GraphQL query/mutation string builders
    routes/
      (app)/
        [table]/
          +page.svelte          # List view
          +page.server.ts       # List data loader
          new/
            +page.svelte        # Create form
            +page.server.ts     # Create action handler
          [id]/
            +page.svelte        # Detail/edit view
            +page.server.ts     # Detail loader + update/delete actions
  tests/
    crud/
      query-builder.test.ts     # Unit tests for GraphQL query generation
```

## Decision References

- ADR-002: PostGraphile V5 — CRUD uses PostGraphile's auto-generated GraphQL mutations
- ADR-004: SvelteKit — CRUD routes are SvelteKit server-side rendered pages
- ADR-005: RBAC — UI filters columns/actions based on effective permissions
