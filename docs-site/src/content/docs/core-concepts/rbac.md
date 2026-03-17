---
title: Role-Based Access Control
description: The three-layer RBAC model, functional roles, and the code ceiling principle.
---

## Three Layers

SIMPLICITY-ADMIN enforces access control at three layers. Each layer is independent and all three must allow an action for it to succeed.

### 1. PostgreSQL Grants + RLS

The foundation. PostgreSQL `GRANT` statements control which database roles can `SELECT`, `INSERT`, `UPDATE`, or `DELETE` on each table. Row-Level Security (RLS) policies filter rows based on the current user's context, set via `pgSettings` on each request.

### 2. Server-Side Action Guards

The API layer checks permissions before executing any mutation. Even if a user crafts a raw GraphQL request, the server rejects actions the user's role does not permit.

### 3. UI Permission Layer

The SvelteKit admin UI hides or disables controls the current user cannot use. Buttons, menu items, and form fields are conditionally rendered based on resolved permissions.

## Code Ceiling Principle

Code-defined permissions set the maximum. The UI can only restrict further, never expand.

If a role is granted `SELECT` and `INSERT` on a table in code, an admin can restrict that role to `SELECT`-only via the UI. But the UI can never grant `UPDATE` or `DELETE` if code did not allow it. This ensures developers retain ultimate control over security boundaries.

## Functional Roles

SIMPLICITY-ADMIN ships with four functional roles:

| Role | Capabilities |
|------|-------------|
| `anon` | Unauthenticated access. No permissions by default. |
| `app_viewer` | Read-only access to application tables. |
| `app_editor` | Read and write access to application tables. |
| `app_admin` | Full access including user management and configuration. |

These roles map to PostgreSQL database roles. Grants are defined in simplicity-schema YAML:

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

## Column-Level Grants

Restrict access to specific columns per role:

```yaml
grants:
  - role: app_viewer
    privileges: [SELECT]
    columns: [id, name, status]  # Cannot see salary, notes
  - role: app_admin
    privileges: [SELECT, INSERT, UPDATE, DELETE]
    # No columns restriction = all columns
```

## Multi-Role Users

A user can be assigned multiple roles. At login, the user's effective permissions are the union of all assigned roles. Users with multiple roles can switch their active role via the UI to operate with a narrower permission set when needed.

## Super-Admins

Super-admin users bypass all permission checks. This role is intended for initial setup and emergency access only. Super-admin status is set directly in the `_simplicity.users` table and cannot be assigned through the UI.
