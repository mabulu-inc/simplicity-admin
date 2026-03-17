---
title: System Schema
description: Complete reference for the _simplicity system schema, tables, roles, and seed data.
---

SIMPLICITY-ADMIN stores its internal state in a dedicated PostgreSQL schema, separate from your application tables. This page documents every system table, database role, and default seed data.

## When the Schema Is Created

The system schema is created during `bootstrap()`, which runs automatically on:

- First `dev` startup (`npx simplicity-admin dev`)
- Running `migrate apply`

Bootstrap is idempotent — it is safe to run multiple times without side effects.

## Schema Name

The default schema name is **`_simplicity`**. You can change it via the `systemSchema` config option:

```ts
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';

export default defineConfig({
  database: process.env.DATABASE_URL,
  systemSchema: 'my_admin_schema',
});
```

Your application tables in `public` (or any other schema) are never modified by SIMPLICITY-ADMIN.

## System Tables

### `users`

User accounts for authentication and identity.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `email` | `text` | Unique email address |
| `password_hash` | `text` | Bcrypt-hashed password |
| `display_name` | `text` | Optional display name |
| `super_admin` | `boolean` | Whether this user is a super admin (default: `false`) |
| `active` | `boolean` | Whether the account is active (default: `true`) |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges | Column restrictions |
|------|-----------|-------------------|
| `app_viewer` | SELECT | `id`, `email`, `display_name`, `active` only |
| `app_editor` | SELECT | `id`, `email`, `display_name`, `active` only |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE | All columns |

---

### `tenants`

Workspace/organization isolation for multi-tenancy.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `name` | `text` | Tenant display name |
| `slug` | `text` | Unique URL-safe identifier (must match `^[a-z0-9][a-z0-9-]*$`) |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges | Column restrictions |
|------|-----------|-------------------|
| `app_viewer` | SELECT | `id`, `name`, `slug` only |
| `app_editor` | SELECT | `id`, `name`, `slug` only |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE | All columns |

---

### `memberships`

Links users to tenants with a functional role assignment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | References `users.id` (CASCADE on delete) |
| `tenant_id` | `uuid` | References `tenants.id` (CASCADE on delete) |
| `role` | `text` | Functional database role (`app_viewer`, `app_editor`, or `app_admin`) |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

---

### `revoked_tokens`

JWT blocklist that persists across server restarts.

| Column | Type | Description |
|--------|------|-------------|
| `token_hash` | `text` | Primary key — SHA-256 hash of the revoked token |
| `revoked_at` | `timestamptz` | When the token was revoked (default: `now()`) |
| `expires_at` | `timestamptz` | When the token naturally expires (used for cleanup) |

**Access:**

| Role | Privileges |
|------|-----------|
| `authenticator` | SELECT, INSERT, DELETE |

---

### `simplicity_state_machines`

Workflow state machine definitions — one per table/column combination.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `table_name` | `text` | Table this state machine governs |
| `column_name` | `text` | Column that holds the state value |
| `states` | `jsonb` | Array of state definition objects |
| `transitions` | `jsonb` | Array of transition objects with roles, guards, and hooks |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

---

### `simplicity_transition_log`

Audit trail for state machine transitions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `table_name` | `text` | Table where the transition occurred |
| `record_id` | `text` | ID of the record that transitioned |
| `from_state` | `text` | State before the transition |
| `to_state` | `text` | State after the transition |
| `user_id` | `uuid` | References `users.id` (SET NULL on delete) — who performed the transition |
| `comment` | `text` | Optional comment provided during transition |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT, INSERT |
| `app_admin` | SELECT, INSERT |

---

### `simplicity_dashboards`

Dashboard definitions with widget layouts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `name` | `text` | Dashboard display name |
| `slug` | `text` | Unique URL-safe identifier |
| `roles` | `text[]` | Which roles can see this dashboard (default: `{}`) |
| `is_default` | `boolean` | Whether this is the default dashboard (default: `false`) |
| `layout` | `jsonb` | Widget layout configuration (default: `[]`) |
| `created_by` | `text` | Who created this dashboard |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

---

### `simplicity_widgets`

Data-driven UI components for dashboards.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `type` | `text` | Widget type identifier |
| `title` | `text` | Widget display title |
| `config` | `jsonb` | Widget configuration (default: `{}`) |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

---

### `simplicity_notification_rules`

Notification trigger rules with conditions, templates, and delivery channels.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `name` | `text` | Rule display name |
| `enabled` | `boolean` | Whether this rule is active (default: `true`) |
| `trigger` | `text` | Event type: `record.created`, `record.updated`, `record.deleted`, `field.changed`, or `schedule` |
| `table` | `text` | Which table triggers this rule (for record events) |
| `field` | `text` | Which field (for `field.changed` trigger) |
| `condition` | `text` | Simple condition expression, e.g. `status = 'urgent'` |
| `channels` | `jsonb` | Delivery channels: `in_app`, `email` (default: `["in_app"]`) |
| `template` | `jsonb` | Template with `subject` and `body` supporting `{{field}}` interpolation (default: `{}`) |
| `recipients` | `jsonb` | Recipient config: `{ type: roles|users|field, roles?, userIds?, field? }` (default: `{}`) |
| `schedule` | `text` | Cron expression for schedule trigger |
| `created_by` | `text` | Who created this rule |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_viewer` | SELECT |
| `app_editor` | SELECT |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

---

### `simplicity_notifications`

Delivered notification records for in-app and email channels.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | References `users.id` (CASCADE on delete) — notification recipient |
| `channel` | `text` | Delivery channel: `in_app` or `email` |
| `subject` | `text` | Notification subject line |
| `body` | `text` | Notification body content |
| `read` | `boolean` | Whether the notification has been read (default: `false`) |
| `rule_id` | `uuid` | References `simplicity_notification_rules.id` (SET NULL on delete) |
| `record_id` | `text` | ID of the record that triggered this notification |
| `table_name` | `text` | Table name of the triggering record |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges | Column restrictions |
|------|-----------|-------------------|
| `app_viewer` | SELECT, UPDATE | `id`, `user_id`, `read` only |
| `app_editor` | SELECT, INSERT, UPDATE | All columns |
| `app_admin` | SELECT, INSERT, UPDATE, DELETE | All columns |

---

### `simplicity_permission_overrides`

UI-defined permission overrides — can only DENY access, never exceed the code ceiling.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `role` | `text` | Target role name |
| `table_name` | `text` | Target table |
| `column_name` | `text` | Target column (nullable — null means table-level) |
| `operation` | `text` | Operation being denied |
| `denied` | `boolean` | Whether access is denied (default: `true`) |
| `created_by` | `text` | Who created this override |
| `created_at` | `timestamptz` | Record creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

**Access:**

| Role | Privileges |
|------|-----------|
| `app_admin` | SELECT, INSERT, UPDATE, DELETE |

## Default Seed Data

On first bootstrap, SIMPLICITY-ADMIN creates the following seed data:

| Entity | Details |
|--------|---------|
| **Default tenant** | Name: `Default`, slug: `default` |
| **Admin user** | Email: `admin@localhost`, password: `changeme`, super_admin: `true` |
| **Admin membership** | Links `admin@localhost` to the `Default` tenant with role `app_admin` |

:::caution[Change the default password]
The default admin password is `changeme`. Change it immediately in any non-development environment.
:::

## Database Roles

Bootstrap creates five PostgreSQL roles used for access control:

| Role | Login | Inherit | Purpose |
|------|-------|---------|---------|
| `authenticator` | Yes | Yes | Connection role — switches to functional roles via `SET LOCAL role` |
| `anon` | No | No | Unauthenticated requests — minimal or no access |
| `app_viewer` | No | Yes | Read-only application access |
| `app_editor` | No | Yes | Read and write application access |
| `app_admin` | No | Yes | Full application access including delete and system administration |

The `authenticator` role is a member of all four functional roles (`anon`, `app_viewer`, `app_editor`, `app_admin`) and switches between them based on the authenticated user's membership role for the current tenant.
