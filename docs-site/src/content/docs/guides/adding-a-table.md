---
title: Adding a Table
description: Create a table with simplicity-schema and have SIMPLICITY-ADMIN generate views and API endpoints automatically.
---

This guide walks through adding a new `products` table to your SIMPLICITY-ADMIN project, including RBAC grants and view customization.

## 1. Define the Table

Create a simplicity-schema YAML file:

```yaml
# schema/tables/products.yaml
table: products
columns:
  - name: id
    type: uuid
    primaryKey: true
    default: gen_random_uuid()
  - name: name
    type: text
    nullable: false
  - name: description
    type: text
  - name: price
    type: numeric(10,2)
    nullable: false
  - name: category_id
    type: uuid
    references: categories.id
  - name: status
    type: product_status
  - name: created_at
    type: timestamptz
    default: now()
```

## 2. Run Migrations

If your project uses simplicity-schema migrations, apply them:

```bash
npx simplicity-admin dev
```

On startup, SIMPLICITY-ADMIN detects the new schema file, runs the migration, and introspects the result.

## 3. Auto-Generated Output

With no additional configuration, you now have:

- **List view** at `/admin/products` — DataTable with all columns, pagination, sorting, and filtering
- **Detail view** at `/admin/products/:id` — AutoForm with fields for every column
- **Create form** at `/admin/products/new` — AutoForm in create mode
- **GraphQL API** — `products` query, `createProduct`, `updateProduct`, `deleteProduct` mutations
- **Relation handling** — `category_id` renders as a relation picker linked to the `categories` table
- **Enum handling** — `status` renders as a dropdown with `product_status` enum values

## 4. Add RBAC Grants

Add grants to the YAML file to control access per role:

```yaml
# schema/tables/products.yaml
grants:
  - role: app_viewer
    privileges: [SELECT]
  - role: app_editor
    privileges: [SELECT, INSERT, UPDATE]
  - role: app_admin
    privileges: [SELECT, INSERT, UPDATE, DELETE]
```

Users with the `app_viewer` role see the list and detail views but cannot create, edit, or delete. The UI automatically hides action buttons they cannot use.

## 5. Customize the View

Create a view YAML file to control how the table is displayed:

```yaml
# views/products.view.yaml
table: products
list:
  columns: [name, price, status, category, created_at]
  defaultSort: created_at:desc
  filters:
    - column: status
      operator: equalTo
      default: ACTIVE
detail:
  sections:
    - title: Product Info
      columns: [name, description, price, status]
    - title: Metadata
      columns: [category_id, created_at]
```

This overrides the default auto-generated view. The list view now shows only the specified columns in order, sorts by `created_at` descending, and pre-filters to active products.
