---
title: "@mabulu-inc/simplicity-admin-ui"
description: SvelteKit admin interface with metadata-driven rendering and theming.
---

The `ui` package implements the `UIProvider` interface from `core`. It is a SvelteKit application that renders the admin interface based on introspected schema metadata.

**Dependencies:** `@mabulu-inc/simplicity-admin-core`

## Metadata-Driven Rendering

The UI maps column types to components automatically:

| Column Type | Component |
|------------|-----------|
| `text`, `varchar` | Text input |
| `integer`, `numeric` | Number input |
| `boolean` | Toggle switch |
| `date` | Date picker |
| `timestamp` | DateTime picker |
| `uuid` (FK) | Relation picker |
| `enum` | Dropdown select |
| `json`, `jsonb` | JSON editor |

No configuration is needed for basic rendering. Adding a column to your database table is enough for the corresponding form field to appear.

## Core Components

### Shell

The top-level layout containing the sidebar, top bar, and content area.

### Sidebar

Navigation generated from the introspected tables. Tables are listed alphabetically and grouped by schema if multiple schemas are configured.

### TopBar

Displays the current view title, breadcrumbs, and user menu (role display, role switching, logout).

### DataTable

The list view component. Supports sorting, filtering, pagination, column visibility, and row selection. Columns are generated from `ColumnMeta`.

### AutoForm

The detail/create/edit form component. Fields are generated from `ColumnMeta` and `RelationMeta`. Validation rules are derived from column constraints (not-null, type, length).

## View Layer

Views can be customized at four levels, each overriding the previous:

1. **Auto-generated** — Default views derived from schema metadata
2. **Developer YAML** — Custom view definitions in `views/*.view.yaml`
3. **Admin overrides** — Admins can adjust views via the UI (column order, visibility, defaults)
4. **User saved views** — Individual users can save personal view configurations

### Developer View YAML

```yaml
# views/products.view.yaml
table: products
list:
  columns: [name, status, category, created_at]
  defaultSort: created_at:desc
  filters:
    - column: status
      operator: equalTo
      default: ACTIVE
detail:
  sections:
    - title: Basic Info
      columns: [name, description, status]
    - title: Relations
      columns: [category_id]
```

## Design Tokens and Theming

The UI uses CSS custom properties for theming. Override tokens to match your brand:

```css
:root {
  --sa-color-primary: #4f46e5;
  --sa-color-surface: #ffffff;
  --sa-color-text: #1f2937;
  --sa-radius: 0.375rem;
  --sa-font-family: 'Inter', sans-serif;
}
```
