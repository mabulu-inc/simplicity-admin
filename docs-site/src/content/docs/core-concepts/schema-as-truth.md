---
title: Schema-as-Truth
description: How the database schema drives every layer of SIMPLICITY-ADMIN.
---

## Principle

Your PostgreSQL database schema is the single source of truth. SIMPLICITY-ADMIN introspects it and derives everything else automatically:

| Schema Element | Generated Output |
|---------------|-----------------|
| Tables | CRUD list and detail views |
| Columns | Form fields with correct input types |
| Foreign keys | Relation lookups and nested navigation |
| Enums | Dropdown select fields |
| Constraints | Client and server-side validation |

Change a column type from `text` to `integer`, and the form field updates from a text input to a number input. Add a foreign key, and a relation picker appears. No code changes required.

## Introspection Pipeline

The introspection process follows a fixed pipeline:

```
PostgreSQL
  → information_schema queries
    → type mapping (pg types → field types)
      → relation resolution (FK → parent/child links)
        → SchemaMeta output
```

The result is a `SchemaMeta` object containing structured metadata for every table, column, relation, and enum in the target schema.

### SchemaMeta Structure

```ts
interface SchemaMeta {
  tables: TableMeta[];
  enums: EnumMeta[];
}

interface TableMeta {
  name: string;
  schema: string;
  columns: ColumnMeta[];
  relations: RelationMeta[];
  primaryKey: string[];
}

interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
}

interface RelationMeta {
  foreignTable: string;
  foreignColumn: string;
  localColumn: string;
  type: 'many-to-one' | 'one-to-many';
}

interface EnumMeta {
  name: string;
  values: string[];
}
```

## System Schema vs Application Schema

SIMPLICITY-ADMIN uses two schemas:

### Application Schema (default: `public`)

Your tables. SIMPLICITY-ADMIN introspects this schema and generates the admin interface. Configure it with the `schema` option in your config file.

### System Schema (`_simplicity_admin`)

Created automatically on first startup. Stores internal state: user accounts, sessions, role assignments, saved views, and audit logs. This schema is managed entirely by SIMPLICITY-ADMIN via simplicity-schema and should not be modified manually.

## Schema Management with simplicity-schema

SIMPLICITY-ADMIN uses simplicity-schema for declarative DDL. Define your tables in YAML, and simplicity-schema handles migrations:

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
  - name: category_id
    type: uuid
    references: categories.id
  - name: status
    type: product_status  # enum
```

When SIMPLICITY-ADMIN starts, it introspects the result and generates views, forms, and API endpoints for this table automatically.
