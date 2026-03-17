# Navigation Module Specification

**PRD Reference:** §5 (US-010)

## Overview

The navigation module provides role-based, customizable navigation menus for the admin UI. By default, navigation is auto-generated from the database schema — one menu item per table, alphabetically sorted. Developers can customize navigation via config (grouping, ordering, icons, labels). The navigation automatically filters based on the current user's RBAC permissions.

## Package Location

- Config types: `packages/core/src/config/types.ts` (NavConfig)
- Navigation builder: `packages/ui/src/lib/nav/`
- Sidebar component: `packages/ui/src/lib/components/Sidebar.svelte`

## Dependencies

- `@mabulu-inc/simplicity-admin-core` — metadata types, config types
- `@mabulu-inc/simplicity-admin-auth` — RBAC (effective permissions for the current user)

## Public API

### Navigation Config

```typescript
// Extends ProjectConfig
export interface NavConfig {
  /** Custom navigation items. If omitted, auto-generated from schema. */
  items?: NavItemConfig[];
  /** Default icon for auto-generated items */
  defaultIcon?: string;
}

export interface NavItemConfig {
  /** Table name (must match a table in the schema) */
  table?: string;
  /** Display label (defaults to humanized table name) */
  label?: string;
  /** Icon identifier */
  icon?: string;
  /** Group heading (items with same group are grouped together) */
  group?: string;
  /** Sort order within group (lower = higher in list) */
  order?: number;
  /** Custom href (for non-table pages like dashboards) */
  href?: string;
  /** Roles that can see this item (defaults to: any role with SELECT on the table) */
  roles?: string[];
  /** Nested items (one level of nesting) */
  children?: NavItemConfig[];
}
```

### Navigation Builder

```typescript
// packages/ui/src/lib/nav/builder.ts

export function buildNavItems(
  meta: SchemaMeta,
  config: NavConfig | undefined,
  permissions: EffectivePermissions
): NavItem[];

export function humanizeTableName(tableName: string): string;
```

### NavItem (runtime, for Sidebar)

```typescript
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  group?: string;
  order: number;
  badge?: number;
  children?: NavItem[];
}
```

## Behavior Specification

### B-NAV-001: Auto-Generated Navigation
**Given** tables `contacts`, `deals`, `products` in the schema and NO nav config
**When** `buildNavItems(meta, undefined, permissions)` is called
**Then** returns 3 NavItems: "Contacts", "Deals", "Products" (alphabetical), each with href `/admin/[table]`

### B-NAV-002: Humanized Labels
**Given** a table named `deal_products`
**When** auto-generating navigation
**Then** the label is "Deal Products" (underscores → spaces, title case)

### B-NAV-003: RBAC Filtering
**Given** user has role `app_viewer` with SELECT on `contacts` and `deals` but NOT `audit_log`
**When** `buildNavItems(meta, undefined, permissions)` is called
**Then** `audit_log` is NOT in the returned items

### B-NAV-004: Custom Config — Grouping
**Given** nav config with items: `[{ table: "contacts", group: "CRM" }, { table: "deals", group: "CRM" }, { table: "products", group: "Catalog" }]`
**When** `buildNavItems()` is called
**Then** items are grouped: "CRM" group contains Contacts + Deals, "Catalog" group contains Products

### B-NAV-005: Custom Config — Ordering
**Given** nav config with `deals` having `order: 1` and `contacts` having `order: 2`
**When** `buildNavItems()` is called
**Then** Deals appears before Contacts

### B-NAV-006: Custom Config — Custom Labels
**Given** nav config with `{ table: "contacts", label: "People" }`
**When** `buildNavItems()` is called
**Then** the item for contacts has label "People"

### B-NAV-007: Custom Config — Icons
**Given** nav config with `{ table: "contacts", icon: "users" }`
**When** `buildNavItems()` is called
**Then** the item has `icon: "users"`

### B-NAV-008: Custom Config — Role Restriction
**Given** nav config with `{ table: "settings", roles: ["app_admin"] }`
**When** user with role `app_editor` calls `buildNavItems()`
**Then** "Settings" is NOT in the returned items

### B-NAV-009: Custom Config — Non-Table Items
**Given** nav config with `{ label: "Dashboard", href: "/admin/dashboard", icon: "chart" }`
**When** `buildNavItems()` is called
**Then** a "Dashboard" item is included with href "/admin/dashboard"

### B-NAV-010: System Tables Excluded
**Given** system tables `users`, `tenants`, `memberships` exist
**When** auto-generating navigation
**Then** system tables are NOT included (they belong to the system schema, not the app schema)

### B-NAV-011: Collapse/Expand Groups
**Given** sidebar with grouped navigation
**When** user clicks a group header
**Then** the group's items collapse/expand

## Error Handling

| Error Condition | Behavior |
|----------------|----------|
| Nav config references non-existent table | Item is silently omitted (with console warning in dev) |
| Nav config has duplicate table entries | First entry wins |
| No tables accessible to user | Shows "No accessible tables" message |

## Security Considerations

- Navigation filtering must happen server-side (in the layout load function), not client-side
- Custom nav items with `roles` must be validated against the user's actual role
- Nav items must not leak table names the user cannot access

## Test Requirements

### Unit Tests
- [ ] `buildNavItems()` auto-generates from schema alphabetically
- [ ] `buildNavItems()` filters by RBAC permissions
- [ ] `buildNavItems()` applies custom grouping
- [ ] `buildNavItems()` applies custom ordering
- [ ] `buildNavItems()` applies custom labels and icons
- [ ] `buildNavItems()` filters by role restriction
- [ ] `buildNavItems()` includes non-table items (custom hrefs)
- [ ] `buildNavItems()` excludes system schema tables
- [ ] `humanizeTableName()` converts snake_case to Title Case
- [ ] `buildNavItems()` silently omits config items referencing non-existent tables

### Component Tests
- [ ] Sidebar renders nav items
- [ ] Sidebar highlights active item
- [ ] Sidebar groups items under section headers
- [ ] Sidebar collapse/expand works

## File Manifest

```
packages/ui/
  src/
    lib/
      nav/
        builder.ts              # buildNavItems() + humanizeTableName()
        types.ts                # NavItemConfig, NavItem types
  tests/
    nav/
      builder.test.ts           # Unit tests for navigation builder
```

## Decision References

- ADR-004: SvelteKit — navigation rendered as SvelteKit sidebar
- ADR-005: RBAC — navigation filtered by user permissions
