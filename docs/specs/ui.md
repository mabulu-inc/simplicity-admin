# UI Module Specification

## Overview

The UI module (`@simplicity-admin/ui`) provides the SvelteKit-based admin interface. It includes reusable components (DataTable, AutoForm, Shell, Sidebar, TopBar), a design token system for theming, and the SvelteKit route structure for the admin panel. Components are metadata-driven — they receive `ColumnMeta[]` and render appropriate UI elements.

## Package Location

- Package: `@simplicity-admin/ui`
- Source: `packages/ui/src/`
- Tests: `packages/ui/tests/`

## Dependencies

- `@simplicity-admin/core` — metadata types (ColumnMeta, TableMeta, EnumMeta)
- `svelte` — Svelte 5 (runes)
- `@sveltejs/kit` — SvelteKit 2
- `tailwindcss` — Tailwind CSS v4

## Public API

### Components

```typescript
// DataTable.svelte
interface DataTableProps {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  actions?: ActionMeta[];                // Available actions for this table
  selectable?: boolean;                  // Enable row selection checkboxes (for bulk actions)
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  onAction?: (action: string, rows: Record<string, unknown>[]) => void;
}

/** Action metadata sent from server to UI */
interface ActionMeta {
  name: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  bulk?: boolean;
  placement: Array<'row' | 'toolbar' | 'detail'>;
  confirm?: string | { title: string; message: string };
}

// AutoForm.svelte
interface AutoFormProps {
  columns: ColumnMeta[];
  values?: Record<string, unknown>;    // Omit for create mode
  readOnlyColumns?: string[];          // RBAC: columns user can see but not edit
  hiddenColumns?: string[];            // RBAC: columns user cannot see at all
  actions?: ActionMeta[];              // Actions available for this record (from row._actions)
  onSubmit?: (data: Record<string, unknown>) => void;
  onDelete?: () => void;               // Omit to hide delete button
  onAction?: (action: string) => void;
}

// Shell.svelte
interface ShellProps {
  children: Snippet;                   // Svelte 5 snippet for content area
}

// Sidebar.svelte
interface SidebarProps {
  items: NavItem[];
  currentPath: string;
}

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  group?: string;
  badge?: number;
}

// TopBar.svelte
interface TopBarProps {
  user: { email: string; displayName: string; avatarUrl?: string };
  roles: string[];                                        // All roles assigned to the user
  activeRole: string;                                     // Currently selected role
  onRoleChange?: (role: string) => void;                  // Triggers role switch + UI refresh
  superAdmin?: boolean;                                   // Enables global mode option in tenant switcher
  tenants?: { id: string; name: string }[];               // Omit if tenancy disabled
  currentTenantId?: string | null;                        // null = global mode (super-admin only)
  onTenantChange?: (tenantId: string | null) => void;     // null = enter global mode
  onLogout?: () => void;
}
```

### Design Tokens

```typescript
// packages/ui/src/lib/tokens/types.ts

export interface ThemeTokens {
  // Colors
  colorPrimary: string;
  colorPrimaryHover: string;
  colorSurface: string;
  colorSurfaceRaised: string;
  colorText: string;
  colorTextMuted: string;
  colorBorder: string;
  colorError: string;
  colorSuccess: string;
  colorWarning: string;

  // Spacing
  space1: string;    // 0.25rem
  space2: string;    // 0.5rem
  space3: string;    // 0.75rem
  space4: string;    // 1rem
  space6: string;    // 1.5rem
  space8: string;    // 2rem

  // Typography
  fontSans: string;
  fontMono: string;
  textSm: string;
  textBase: string;
  textLg: string;
  textXl: string;

  // Border radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
}
```

### Theme Application

```typescript
// packages/ui/src/lib/themes/index.ts

export const lightTheme: ThemeTokens;
export const darkTheme: ThemeTokens;
export function applyTheme(tokens: ThemeTokens): void;
export function getSystemPreference(): 'light' | 'dark';
```

### Column Type → Component Mapping

```typescript
// packages/ui/src/lib/components/field-map.ts

export type FieldComponent =
  | 'TextInput' | 'NumberInput' | 'Toggle' | 'Select'
  | 'DatePicker' | 'DateTimePicker' | 'RelationPicker'
  | 'JSONEditor' | 'TagInput' | 'TextArea';

export function getFieldComponent(column: ColumnMeta): FieldComponent;
export function getDisplayFormatter(column: ColumnMeta): (value: unknown) => string;
```

## Behavior Specification

### B-UI-001: DataTable — Column Headers
**Given** a `ColumnMeta[]` with columns `id`, `name`, `email`
**When** DataTable renders
**Then** three column headers are shown with human-readable labels ("ID", "Name", "Email")

### B-UI-002: DataTable — Row Rendering
**Given** rows `[{ id: 1, name: "Alice", email: "alice@ex.com" }]`
**When** DataTable renders
**Then** one row is shown with values in the correct columns

### B-UI-003: DataTable — Sort Click
**Given** DataTable with sortable columns
**When** user clicks the "Name" column header
**Then** `onSort("name", "asc")` is called; clicking again calls `onSort("name", "desc")`

### B-UI-004: DataTable — Pagination
**Given** `totalCount: 50`, `pageSize: 25`, `page: 1`
**When** DataTable renders
**Then** pagination shows "1-25 of 50" with a "Next" button; "Previous" is disabled

### B-UI-005: DataTable — Row Click
**Given** DataTable with `onRowClick` handler
**When** user clicks a row
**Then** `onRowClick(row)` is called with the row data

### B-UI-006: DataTable — Empty State
**Given** `rows: []` and `totalCount: 0`
**When** DataTable renders
**Then** shows "No records found" message

### B-UI-007: DataTable — Boolean Formatting
**Given** a boolean column `active`
**When** DataTable renders a row with `active: true`
**Then** displays a checkmark icon (not "true" text)

### B-UI-008: DataTable — Date Formatting
**Given** a timestamp column `created_at`
**When** DataTable renders a row with `created_at: "2024-03-15T10:30:00Z"`
**Then** displays formatted date (e.g., "Mar 15, 2024")

### B-UI-009: AutoForm — Field Generation
**Given** `ColumnMeta[]` with a text column, boolean column, and enum column
**When** AutoForm renders in create mode
**Then** renders TextInput, Toggle, and Select components respectively

### B-UI-010: AutoForm — Edit Mode
**Given** `values: { name: "Alice", active: true }`
**When** AutoForm renders in edit mode
**Then** TextInput has value "Alice", Toggle is checked

### B-UI-011: AutoForm — Required Validation
**Given** a column with `nullable: false` and `hasDefault: false`
**When** user submits without filling this field
**Then** shows inline error "This field is required"

### B-UI-012: AutoForm — PK/Generated Fields Hidden
**Given** columns include `id` (PK) and `created_at` (has default)
**When** AutoForm renders in create mode
**Then** `id` and `created_at` are NOT shown (they have defaults/are auto-generated)

### B-UI-013: AutoForm — Read-Only Columns
**Given** `readOnlyColumns: ['created_at']`
**When** AutoForm renders in edit mode
**Then** `created_at` is displayed but disabled (read-only)

### B-UI-014: AutoForm — Submit
**Given** user fills name="Bob", email="bob@ex.com"
**When** user clicks Save
**Then** `onSubmit({ name: "Bob", email: "bob@ex.com" })` is called with form data

### B-UI-015: AutoForm — Delete Button
**Given** `onDelete` handler is provided
**When** AutoForm renders
**Then** a Delete button is visible; clicking it triggers a confirmation dialog

### B-UI-016: Shell — Layout
**Given** Shell component
**When** it renders
**Then** shows Sidebar on the left and content area on the right

### B-UI-017: Sidebar — Navigation Items
**Given** `items: [{ label: "Contacts", href: "/admin/contacts" }, { label: "Deals", href: "/admin/deals" }]`
**When** Sidebar renders
**Then** two navigation links are visible with correct labels and hrefs

### B-UI-018: Sidebar — Active Item
**Given** `currentPath: "/admin/contacts"`
**When** Sidebar renders
**Then** the "Contacts" item has active/highlighted styling

### B-UI-019: Sidebar — Groups
**Given** items with `group: "CRM"` and `group: "Settings"`
**When** Sidebar renders
**Then** items are grouped under section headers "CRM" and "Settings"

### B-UI-020: TopBar — User Menu
**Given** `user: { email: "alice@ex.com", displayName: "Alice" }`
**When** TopBar renders
**Then** shows user avatar/initial and display name; clicking opens dropdown with Logout option

### B-UI-021: TopBar — Tenant Switcher (Multiple Tenants)
**Given** `tenants: [{ id: "1", name: "Acme" }, { id: "2", name: "Globex" }]`, `currentTenantId: "1"`
**When** TopBar renders
**Then** shows "Acme" with a dropdown to switch to "Globex"

### B-UI-022: TopBar — No Tenant Switcher (Tenancy Disabled)
**Given** `tenants` prop is omitted
**When** TopBar renders
**Then** no tenant switcher is shown

### B-UI-023-b: TopBar — Single Tenant Hides Dropdown
**Given** `tenants: [{ id: "1", name: "Acme" }]` (only one tenant)
**When** TopBar renders
**Then** the tenant name "Acme" is displayed but the dropdown trigger is hidden (no switching needed)

### B-UI-023-c: TopBar — Tenant Switch Triggers JWT Refresh
**Given** user selects "Globex" from the tenant switcher dropdown
**And** the user's auth strategy is available in Globex
**When** `onTenantChange("2")` fires
**Then** the app calls `POST /auth/switch-tenant`, receives a new token pair (with updated tenantId and tenant-scoped roles), and reloads all page data — navigation, tables, and forms reflect the new tenant's data and the user's roles within that tenant

### Login Page

### B-UI-035: Login — Strategy-Driven Rendering
**Given** the resolved tenant has strategies: password + OAuth (Office 365)
**When** the login page renders
**Then** shows an email/password form AND a "Sign in with Office 365" button — rendered dynamically from `GET /auth/strategies`

### B-UI-036: Login — Password Only
**Given** the resolved tenant has only the password strategy
**When** the login page renders
**Then** shows only the email/password form with no OAuth/OTP buttons

### B-UI-037: Login — OAuth Only (No Password)
**Given** the resolved tenant has only OAuth (Google) configured
**When** the login page renders
**Then** shows only a "Sign in with Google" button — no email/password form

### B-UI-038: Login — Tenant Branding
**Given** the resolved tenant has a name "Acme Corp"
**When** the login page renders
**Then** the tenant name is displayed (e.g., "Sign in to Acme Corp") so the user knows they're at the right place

### Tenant Switching

### B-UI-023-d: TopBar — Tenant Switch Requires Re-Auth
**Given** user authenticated with "oauth:office365" in tenant Acme
**And** tenant Globex does not support the "oauth:office365" strategy
**When** `onTenantChange("globex-id")` fires and the server responds with 403 (strategy not available)
**Then** the tenant switcher shows a message: "Sign out and sign in to Globex directly" with a sign-out link — the user is NOT silently logged out

### B-UI-026: TopBar — Role Switcher (Multiple Roles)
**Given** `roles: ["app_admin", "app_editor", "app_viewer"]` and `activeRole: "app_admin"`
**When** TopBar renders
**Then** shows the active role label (e.g., "Admin") with a dropdown listing all available roles

### B-UI-027: TopBar — Role Switch Triggers Refresh
**Given** user selects "Viewer" from the role switcher dropdown
**When** `onRoleChange("app_viewer")` fires
**Then** the app calls `POST /auth/switch-role`, receives a new token pair, and reloads the current page data (navigation, table columns, form fields all update to reflect the new role's permissions)

### B-UI-028: TopBar — Single Role Hides Switcher
**Given** `roles: ["app_viewer"]` (only one role)
**When** TopBar renders
**Then** the active role label is shown but the dropdown trigger is hidden (no switching needed)

### B-UI-029: Role Switch — Navigation Updates
**Given** user switches from `app_admin` (full access) to `app_viewer` (limited access)
**When** the role switch completes
**Then** sidebar navigation rebuilds — items for tables the viewer cannot access are removed

### B-UI-030: Role Switch — DataTable Columns Update
**Given** user switches from `app_editor` (can see salary column) to `app_viewer` (cannot see salary)
**When** viewing the contacts table
**Then** the salary column disappears from the DataTable (not hidden via CSS — removed from the DOM)

### B-UI-032: TopBar — Super-Admin Tenant Switcher
**Given** `superAdmin: true` and `tenants` contains all system tenants
**When** TopBar renders the tenant switcher
**Then** all tenants are listed plus a "Global" option at the top of the dropdown

### B-UI-033: TopBar — Global Mode Indicator
**Given** `superAdmin: true` and `currentTenantId: null` (global mode)
**When** TopBar renders
**Then** shows "Global" as the current context with a visual indicator (e.g., distinct badge/color) signaling cross-tenant access

### B-UI-034: DataTable — Global Mode Tenant Column
**Given** super-admin is in global mode viewing a tenant_scoped table
**When** DataTable renders
**Then** a "Tenant" column is automatically prepended showing which tenant each row belongs to

### Custom Actions

### B-UI-039: DataTable — Row Actions
**Given** an order row with `_actions: ['approve', 'cancel']` and actions have `placement: ['row']`
**When** DataTable renders the row
**Then** an actions column shows "Approve" and "Cancel" buttons (or an overflow menu if more than 2 actions)

### B-UI-040: DataTable — Action Not Available
**Given** an order row with `_actions: ['cancel']` (no `approve` because it's already approved)
**When** DataTable renders the row
**Then** only the "Cancel" button appears — "Approve" is not rendered

### B-UI-041: DataTable — Bulk Actions
**Given** actions include `archive` with `bulk: true` and `placement: ['toolbar']`
**When** user selects 3 rows via checkboxes
**Then** the toolbar shows an "Archive" button with a count badge ("Archive (3)")

### B-UI-042: DataTable — Bulk Selection Enables Checkboxes
**Given** at least one action has `bulk: true`
**When** DataTable renders
**Then** a checkbox column appears on the left for row selection

### B-UI-043: DataTable — No Bulk Actions, No Checkboxes
**Given** no actions have `bulk: true`
**When** DataTable renders
**Then** no checkbox column is shown

### B-UI-044: AutoForm — Detail Actions
**Given** a deal record with `_actions: ['close_deal', 'create_invoice']` and actions have `placement: ['detail']`
**When** AutoForm renders in edit mode
**Then** action buttons appear in the form header alongside Save/Delete

### B-UI-045: Action — Confirmation Dialog
**Given** action `close_deal` has `confirm: 'This will lock the deal. Continue?'`
**When** user clicks "Close Deal"
**Then** a confirmation dialog appears with the message — confirming invokes the action, cancelling does nothing

### B-UI-046: Action — Toast on Success
**Given** action handler returns `{ message: 'Deal closed successfully' }`
**When** the action completes
**Then** a success toast shows "Deal closed successfully" and the view refreshes

### B-UI-047: Action — Conflict (Stale Condition)
**Given** user clicks "Approve" but the server returns 409 (condition no longer met)
**When** the error response is received
**Then** a warning toast shows "Action is no longer available for this record" and the view refreshes to show current state

### B-UI-048: Action — Variant Styling
**Given** action `delete_batch` has `variant: 'danger'`
**When** the button renders
**Then** it uses destructive/danger styling (e.g., red color) to signal the action's nature

### B-UI-031: Role Switch — AutoForm Fields Update
**Given** user switches from `app_editor` (can edit email) to `app_viewer` (read-only email)
**When** viewing a contact edit form
**Then** the email field becomes read-only; fields the viewer cannot see are removed entirely

### B-UI-023: Theme — Light Default
**Given** no theme preference set
**When** the app loads
**Then** light theme CSS custom properties are applied

### B-UI-024: Theme — Dark Mode
**Given** user selects dark mode (or system preference is dark)
**When** theme switches
**Then** dark theme CSS custom properties replace light ones

### B-UI-025: Field Mapping
**Given** `ColumnMeta` with `type: 'enum'` and `enumValues: ['draft', 'published']`
**When** `getFieldComponent(column)` is called
**Then** returns `'Select'`

## Error Handling

| Error Condition | Behavior |
|----------------|----------|
| Unknown column type | Renders TextInput as fallback with console warning |
| Image/avatar URL fails to load | Renders initial letter fallback |
| Theme token missing | Falls back to CSS default value |

## Security Considerations

- All data rendering must escape HTML to prevent XSS
- Form submissions must go through the API (never direct DB access from UI)
- Hidden columns (RBAC) must not be present in the DOM (not just `display: none`)
- User avatars must use CSP-safe image loading

## Test Requirements

### Unit Tests
- [ ] `getFieldComponent()` maps all ColumnTypes to correct components
- [ ] `getDisplayFormatter()` formats booleans, dates, enums, nulls correctly
- [ ] `applyTheme()` sets CSS custom properties
- [ ] Light and dark themes have all required tokens

### Component Tests (Svelte component testing)
- [ ] DataTable renders correct column headers
- [ ] DataTable renders rows with correct values
- [ ] DataTable sort click dispatches event
- [ ] DataTable pagination renders correct info
- [ ] DataTable empty state renders
- [ ] AutoForm generates correct field types from metadata
- [ ] AutoForm populates values in edit mode
- [ ] AutoForm validates required fields
- [ ] AutoForm hides PK/generated fields in create mode
- [ ] AutoForm respects readOnlyColumns
- [ ] Shell renders sidebar and content area
- [ ] Sidebar renders navigation items
- [ ] Sidebar highlights active item
- [ ] TopBar renders user info
- [ ] DataTable renders row action buttons from `_actions`
- [ ] DataTable hides actions not in row's `_actions`
- [ ] DataTable shows checkbox column when bulk actions exist
- [ ] DataTable toolbar shows bulk action buttons with selection count
- [ ] AutoForm renders detail action buttons in form header
- [ ] Action confirmation dialog appears when `confirm` is set
- [ ] Action toast displays handler result message
- [ ] Action conflict (409) shows warning and refreshes
- [ ] TopBar renders role switcher when user has multiple roles
- [ ] TopBar hides role switcher when user has single role
- [ ] TopBar role switch calls onRoleChange with selected role
- [ ] TopBar renders tenant switcher when user has multiple tenants
- [ ] TopBar hides tenant dropdown when user has single tenant (shows label only)
- [ ] TopBar hides tenant switcher entirely when tenants omitted
- [ ] TopBar tenant switch calls onTenantChange with selected tenantId

## File Manifest

```
packages/ui/
  src/
    lib/
      index.ts                          # Component re-exports
      tokens/
        types.ts                        # ThemeTokens interface
        primitives.ts                   # Primitive token values
        semantic.ts                     # Semantic token mappings
      themes/
        index.ts                        # Theme exports + applyTheme()
        light.css                       # Light theme CSS
        dark.css                        # Dark theme CSS
      components/
        DataTable.svelte
        AutoForm.svelte
        Shell.svelte
        Sidebar.svelte
        TopBar.svelte
        field-map.ts                    # ColumnType → component mapping
        fields/
          TextInput.svelte
          NumberInput.svelte
          Toggle.svelte
          Select.svelte
          DatePicker.svelte
          DateTimePicker.svelte
          RelationPicker.svelte
          JSONEditor.svelte
          TagInput.svelte
          TextArea.svelte
        RoleSwitcher.svelte
        Toast.svelte
        ConfirmDialog.svelte
  tests/
    components/
      data-table.test.ts
      auto-form.test.ts
      shell.test.ts
      sidebar.test.ts
      top-bar.test.ts
    tokens/
      themes.test.ts
    field-map.test.ts
  package.json
  svelte.config.js
  vite.config.ts
  tsconfig.json
```

## Decision References

- ADR-004: SvelteKit + Svelte 5 — UI framework choice
- ADR-005: RBAC — components respect permission filtering
