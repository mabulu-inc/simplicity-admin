# Views Module Specification

## Overview

The views module controls how data is presented in the admin UI. It operates in four tiers, each building on the last:

1. **Auto-generated defaults** — the framework introspects the schema and relations to produce sensible list and detail views with zero configuration
2. **Developer view definitions** — YAML files (`views/*.view.yaml`) that customize layouts, sections, related data, and field presentation. Version-controlled alongside schema.
3. **Admin view overrides** — runtime UI customizations (hide/show/reorder fields, rearrange sections) stored in `_simplicity_admin` tables. Portable between environments via managed export/import.
4. **User saved views** — personal views (filters, column picks, sort order, layouts) that users can name, save, and share within their tenant. Not subject to managed porting.

View definitions are separate from schema-flow YAML files — schema defines structure, views define presentation.

## Package Location

- View types: `packages/core/src/views/types.ts`
- View loader: `packages/core/src/views/loader.ts`
- View renderer: `packages/ui/src/lib/views/`
- Admin override storage: `packages/db/schema/tables/view_overrides.yaml`
- User saved views storage: `packages/db/schema/tables/saved_views.yaml`
- View YAML files: `views/` directory in the developer's project (alongside `schema/`)

## Dependencies

- `@simplicity-admin/core` — view types, view loader
- `@simplicity-admin/db` — view override and saved view storage
- `@simplicity-admin/ui` — view rendering, customization UI

## Public API

### View Definition Types

```typescript
// packages/core/src/views/types.ts

export interface ViewDefinition {
  /** Table this view applies to */
  table: string;
  /** Detail view configuration (single record) */
  detail?: DetailView;
  /** List view configuration (table/grid) */
  list?: ListView;
}

export interface DetailView {
  /** Ordered sections that compose the detail page */
  sections: ViewSection[];
}

export type ViewSection =
  | FieldsSection
  | RelationSection
  | CustomSection;

export interface FieldsSection {
  type: 'fields';
  /** Optional heading for this section */
  label?: string;
  /** Columns to display (ordered). Omit to show all non-hidden fields. */
  columns?: string[];
  /** Layout: stack fields vertically or arrange in a grid */
  layout?: 'stack' | 'grid';
  /** Number of grid columns (default: 2) */
  gridColumns?: number;
  /** Collapsible section (default: false) */
  collapsible?: boolean;
  /** Start collapsed (default: false) */
  collapsed?: boolean;
}

export interface RelationSection {
  type: 'relation';
  /** Related table name (must have a FK relationship) */
  table: string;
  /** Display mode for related records */
  display: 'table' | 'cards' | 'list' | 'count';
  /** Section heading (defaults to humanized table name) */
  label?: string;
  /** Columns to show in the relation table/cards */
  columns?: string[];
  /** Default filter applied to the related records */
  filter?: Record<string, unknown>;
  /** Default sort for the related records */
  sort?: { column: string; direction: 'asc' | 'desc' };
  /** Max rows to show before "View all" link (default: 5) */
  limit?: number;
  /** Allow inline creation of related records (default: false) */
  inlineCreate?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface CustomSection {
  type: 'custom';
  /** Svelte component name (must be registered) */
  component: string;
  /** Props passed to the component */
  props?: Record<string, unknown>;
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface ListView {
  /** Columns to display (ordered). Omit for auto-selection. */
  columns?: string[];
  /** Default sort */
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  /** Default page size (default: 25) */
  pageSize?: number;
  /** Enable search bar (default: true) */
  searchable?: boolean;
  /** Columns that are searchable (defaults to text/varchar columns) */
  searchColumns?: string[];
  /** Predefined filter presets shown as tabs/chips */
  filterPresets?: FilterPreset[];
}

export interface FilterPreset {
  label: string;
  filter: Record<string, unknown>;
  /** Is this the default active preset? */
  default?: boolean;
}
```

### View Loader

```typescript
// packages/core/src/views/loader.ts

/** Load view definitions from the views/ directory */
export function loadViewDefinitions(viewsDir: string): Promise<ViewDefinition[]>;

/** Generate auto-default view definitions from schema metadata */
export function generateDefaultViews(meta: SchemaMeta): ViewDefinition[];

/** Merge: defaults ← developer YAML ← admin overrides → final view */
export function resolveView(
  table: string,
  defaults: ViewDefinition,
  developerView: ViewDefinition | undefined,
  adminOverrides: ViewOverride[]
): ViewDefinition;
```

### Admin View Overrides

```typescript
// packages/ui/src/lib/views/overrides.ts

export interface ViewOverride {
  id: string;
  table: string;
  /** JSON patch-style overrides to apply to the resolved view */
  overrides: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Save an admin view override (replaces any existing override for this table) */
export function saveViewOverride(pool: ConnectionPool, override: Omit<ViewOverride, 'id' | 'createdAt' | 'updatedAt'>): Promise<ViewOverride>;

/** Get the admin override for a table (if any) */
export function getViewOverride(pool: ConnectionPool, table: string): Promise<ViewOverride | null>;

/** Remove an admin override (restores to developer/default view) */
export function removeViewOverride(pool: ConnectionPool, table: string): Promise<void>;
```

### User Saved Views

```typescript
// packages/ui/src/lib/views/saved-views.ts

export interface SavedView {
  id: string;
  table: string;
  name: string;
  /** The view customizations (column picks, filters, sort, layout tweaks) */
  config: SavedViewConfig;
  /** Who created this view */
  userId: string;
  tenantId: string;
  /** Is this view shared with other users in the tenant? */
  shared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedViewConfig {
  columns?: string[];
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, unknown>;
  pageSize?: number;
  /** Section visibility/order overrides for detail views */
  sections?: { name: string; visible: boolean; order: number }[];
}

export function createSavedView(pool: ConnectionPool, view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedView>;
export function updateSavedView(pool: ConnectionPool, id: string, updates: Partial<SavedViewConfig>): Promise<SavedView>;
export function deleteSavedView(pool: ConnectionPool, id: string): Promise<void>;
export function listSavedViews(pool: ConnectionPool, table: string, userId: string, tenantId: string): Promise<SavedView[]>;
export function getSharedViews(pool: ConnectionPool, table: string, tenantId: string): Promise<SavedView[]>;
```

## View YAML Format

View definitions live in `views/*.view.yaml` in the developer's project, separate from `schema/` files:

```yaml
# views/teams.view.yaml
table: teams

detail:
  sections:
    - type: fields
      label: Team Info
      columns: [name, founded, league, home_stadium]
      layout: grid

    - type: relation
      table: players
      display: table
      label: Roster
      columns: [name, position, jersey_number]
      sort: { column: jersey_number, direction: asc }
      inlineCreate: true

    - type: relation
      table: games
      display: cards
      label: Upcoming Games
      filter: { date: { gte: now } }
      sort: { column: date, direction: asc }
      limit: 3

    - type: relation
      table: games
      display: table
      label: Past Games
      filter: { date: { lt: now } }
      sort: { column: date, direction: desc }
      limit: 10
      collapsible: true
      collapsed: true

list:
  columns: [name, league, home_stadium]
  defaultSort: { column: name, direction: asc }
  searchColumns: [name, league]
  filterPresets:
    - label: All Teams
      default: true
      filter: {}
    - label: Active
      filter: { status: active }
    - label: Archived
      filter: { status: archived }
```

## Behavior Specification

### Auto-Generated Defaults

### B-VIEW-001: Default Detail View
**Given** table `teams` with columns `[id, name, founded, league]` and relations `[players (one-to-many), league (many-to-one)]`
**When** no view definition exists for `teams`
**Then** auto-generates a detail view with: a fields section (all user-facing columns, PK/system fields excluded), and a relation section for each one-to-many relation (displayed as a table)

### B-VIEW-002: Default List View
**Given** table `teams` with columns `[id, name, founded, league, description, metadata_json]`
**When** no view definition exists for `teams`
**Then** auto-generates a list view showing columns suitable for a table: text, number, boolean, date, enum columns included; long text, JSON, and array columns excluded. Sorted by primary key descending.

### B-VIEW-003: Default Relation Detection
**Given** `games` has a FK `home_team_id` referencing `teams.id` and a FK `away_team_id` referencing `teams.id`
**When** auto-generating the `teams` detail view
**Then** generates two relation sections: "Games (Home)" and "Games (Away)" — each filtered by the respective FK column

### Developer View Definitions

### B-VIEW-004: YAML Overrides Defaults
**Given** a `views/teams.view.yaml` file defines detail sections and list columns
**When** the view is loaded
**Then** the YAML definition replaces the auto-generated default entirely — the developer has full control

### B-VIEW-005: Partial YAML — Detail Only
**Given** a `views/teams.view.yaml` file defines `detail:` but omits `list:`
**When** the view is loaded
**Then** the detail view uses the YAML definition; the list view falls back to the auto-generated default

### B-VIEW-006: Filter Presets
**Given** a list view with `filterPresets: [{ label: "Active", filter: { status: "active" }, default: true }]`
**When** the list page renders
**Then** shows filter chips/tabs with "Active" pre-selected, filtering the list to active records

### B-VIEW-007: Relation Section — Inline Create
**Given** a relation section with `inlineCreate: true` for `players` on the `teams` detail view
**When** the user clicks "Add Player" in the Roster section
**Then** an inline form appears within the section (not a separate page) with the team FK pre-filled

### Admin View Overrides

### B-VIEW-008: Admin Hides a Column
**Given** the developer view shows columns `[name, founded, league, home_stadium]` on the teams detail view
**When** an admin hides `founded` via the customization UI
**Then** a view override is saved in `_simplicity_admin.view_overrides`, and `founded` no longer appears for any user

### B-VIEW-009: Admin Reorders Sections
**Given** the detail view has sections: Team Info, Roster, Upcoming Games, Past Games
**When** an admin drags "Upcoming Games" above "Roster"
**Then** the section order updates for all users: Team Info, Upcoming Games, Roster, Past Games

### B-VIEW-010: Admin Override — Restore to Default
**Given** an admin override exists for `teams`
**When** the admin clicks "Reset to default"
**Then** the override is removed and the developer/auto-generated view is restored

### B-VIEW-011: Admin Override — Customization UI
**Given** a user with `app_admin` role views a detail page
**When** they click a "Customize" button (visible only to admins)
**Then** the page enters edit mode: sections become draggable, fields show show/hide toggles, and a "Save" button persists the overrides

### User Saved Views

### B-VIEW-012: Save Personal View
**Given** a user customizes the contacts list: selects columns `[name, email, status]`, sorts by `name asc`, and filters to `status: active`
**When** they click "Save view" and name it "Active Contacts"
**Then** a `SavedView` is persisted with their userId, tenantId, and the config

### B-VIEW-013: Load Saved View
**Given** user has a saved view "Active Contacts" for the contacts list
**When** they navigate to contacts and select "Active Contacts" from the view picker
**Then** the list renders with the saved columns, sort, and filters applied

### B-VIEW-014: Share a View
**Given** user saves a view "Pipeline Overview" on deals
**When** they toggle "Share with team"
**Then** `shared: true` is set, and other users in the same tenant see "Pipeline Overview" in their view picker (under a "Shared" section)

### B-VIEW-015: Shared View — Read-Only for Others
**Given** user Alice shared "Pipeline Overview"
**When** user Bob loads it
**Then** Bob sees the view but cannot modify or delete it — only Alice (the creator) or an admin can edit shared views

### B-VIEW-016: Delete Saved View
**Given** user has a saved view "Old Leads"
**When** they delete it
**Then** the view is removed; if it was shared, it disappears from other users' view pickers

### B-VIEW-017: View Picker UI
**Given** a user navigates to the contacts list and has 2 personal views and 3 shared views
**When** the page renders
**Then** a view picker dropdown appears showing: "Default", then personal views, then shared views grouped under a "Shared" heading

### Resolution Order

### B-VIEW-018: View Resolution — Full Stack
**Given** an auto-generated default exists, a developer YAML overrides it, an admin override hides a column, and the user selects a saved view that re-adds that column
**When** the view is resolved
**Then** the merge order is: auto-default ← developer YAML ← admin override ← user saved view. However, admin overrides take precedence — if an admin hid a column, user saved views cannot re-show it.

### B-VIEW-019: View Resolution — Admin Override Ceiling
**Given** an admin hid the `salary` column on `contacts`
**When** a user creates a saved view that includes `salary`
**Then** `salary` remains hidden — admin overrides set a ceiling that user views cannot exceed (same principle as RBAC ceiling)

## Environment Porting

### B-VIEW-020: Export Admin Overrides
**Given** admin overrides exist for `teams`, `contacts`, and `deals` tables
**When** `npx simplicity-admin env export --output overrides.json` is run
**Then** all admin view overrides are exported as a portable JSON file

### B-VIEW-021: Import Admin Overrides
**Given** an `overrides.json` file from production
**When** `npx simplicity-admin env import --input overrides.json` is run in a sandbox environment
**Then** the admin overrides are applied to the sandbox's `_simplicity_admin.view_overrides` table (upsert by table name)

### B-VIEW-022: Export Includes Schema + Views
**Given** a project with schema-flow YAML in `schema/` and view definitions in `views/`
**When** deploying to another environment
**Then** both directories are version-controlled and deployed together — schema defines structure, views define presentation. Admin overrides are exported/imported separately.

### B-VIEW-023: User Views Not Ported
**Given** user saved views exist in production
**When** admin exports overrides
**Then** user saved views are NOT included — they are tenant/user-scoped and stay in their environment

## Error Handling

| Error Condition | Behavior |
|----------------|----------|
| View YAML references non-existent column | Column is silently omitted (with console warning in dev) |
| View YAML references non-existent relation | Section is silently omitted (with console warning in dev) |
| Saved view references a column the user's role cannot access | Column is excluded from the rendered view (RBAC takes precedence) |
| Import overrides for a table that doesn't exist | Override is skipped with a warning |

## Security Considerations

- User saved views must be scoped to `tenantId` — users in tenant A cannot see or load views from tenant B
- Shared views do not bypass RBAC — if a shared view includes a column the current user's role cannot access, that column is excluded at render time
- Admin override operations require `app_admin` role
- The customization UI ("Customize" button) must only be visible to `app_admin` users
- Saved view configs must not allow arbitrary code execution — they are declarative data only (column names, filter values, sort directions)

## Test Requirements

### Unit Tests
- [ ] `generateDefaultViews()` produces sensible detail view from schema
- [ ] `generateDefaultViews()` excludes JSON/long-text columns from list view
- [ ] `generateDefaultViews()` detects and sections all one-to-many relations
- [ ] `generateDefaultViews()` handles multiple FKs to the same table
- [ ] `resolveView()` merges developer YAML over defaults
- [ ] `resolveView()` applies admin overrides over developer views
- [ ] `resolveView()` enforces admin override ceiling over user views
- [ ] `loadViewDefinitions()` parses valid YAML files
- [ ] `loadViewDefinitions()` warns on invalid column/relation references

### Integration Tests (require real Postgres)
- [ ] `saveViewOverride()` persists admin override
- [ ] `getViewOverride()` returns override for table
- [ ] `removeViewOverride()` restores default view
- [ ] `createSavedView()` persists user view with correct tenant scope
- [ ] `listSavedViews()` returns personal + shared views for user/tenant
- [ ] `getSharedViews()` returns only shared views for the tenant
- [ ] Shared view is visible to other users in same tenant
- [ ] Shared view is NOT visible to users in different tenant
- [ ] Export produces valid JSON with all admin overrides
- [ ] Import applies overrides to target environment (upsert)
- [ ] Import skips overrides for non-existent tables with warning

### Component Tests
- [ ] Detail view renders field sections with correct columns
- [ ] Detail view renders relation sections with related data
- [ ] List view renders correct columns and sort
- [ ] Filter presets render as tabs/chips
- [ ] View picker shows personal and shared views
- [ ] Customization UI allows drag/reorder of sections
- [ ] Customization UI allows hide/show of columns
- [ ] Inline create within relation section works

## File Manifest

```
views/                                # Developer's project (not in simplicity-admin package)
  teams.view.yaml
  contacts.view.yaml
  ...

packages/core/
  src/
    views/
      types.ts                        # ViewDefinition, DetailView, ListView, etc.
      loader.ts                       # YAML loading + default generation
      resolver.ts                     # View merge/resolution logic

packages/db/
  schema/
    tables/
      view_overrides.yaml             # Admin view override storage
      saved_views.yaml                # User saved view storage

packages/ui/
  src/
    lib/
      views/
        renderer.ts                   # View → component tree mapper
        overrides.ts                  # Admin override CRUD
        saved-views.ts                # User saved view CRUD
      components/
        ViewCustomizer.svelte         # Admin customization overlay
        ViewPicker.svelte             # Saved view selector dropdown
        RelationSection.svelte        # Renders related records
        FilterPresets.svelte          # Filter chip/tab bar
```
