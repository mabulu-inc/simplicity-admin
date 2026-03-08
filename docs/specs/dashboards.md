# Dashboards Module Specification

## Overview

The dashboards module provides customizable dashboard pages with data widgets. Dashboards are composed of widgets arranged in a grid layout. Widgets are powered by database queries and display data as stat cards, tables, or charts. Dashboards can be role-specific (different roles see different dashboards) and can serve as landing pages.

## Package Location

- Dashboard engine: `packages/ui/src/lib/dashboards/`
- Dashboard routes: `packages/ui/src/routes/(app)/dashboard/`
- Widget components: `packages/ui/src/lib/components/widgets/`
- Tests: `packages/ui/tests/dashboards/`

## Dependencies

- `@simplicity-admin/core` — config types, metadata types
- `@simplicity-admin/ui` — Shell layout, theming
- GraphQL API — widget data queries

## Public API

### Dashboard Types

```typescript
// packages/ui/src/lib/dashboards/types.ts

export interface Dashboard {
  id: string;
  name: string;
  slug: string;
  roles: string[];           // Roles that can see this dashboard (empty = all)
  isDefault: boolean;         // Landing page for assigned roles
  layout: WidgetLayout[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetLayout {
  widgetId: string;
  x: number;                  // Grid column (0-based)
  y: number;                  // Grid row (0-based)
  width: number;              // Grid columns spanned (1-12)
  height: number;             // Grid rows spanned
}

export interface Widget {
  id: string;
  type: 'stat' | 'table' | 'chart';
  title: string;
  config: StatConfig | TableConfig | ChartConfig;
}

export interface StatConfig {
  query: string;              // SQL query returning single value
  format?: 'number' | 'currency' | 'percent';
  prefix?: string;
  suffix?: string;
  trend?: {
    query: string;            // SQL returning previous period value for comparison
  };
}

export interface TableConfig {
  query: string;              // SQL query returning rows
  columns: { key: string; label: string }[];
  limit?: number;             // Default: 10
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'donut';
  query: string;              // SQL returning { label, value } rows
  colors?: string[];
}
```

### Dashboard Management

```typescript
// packages/ui/src/lib/dashboards/manager.ts

export function createDashboard(pool: ConnectionPool, dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard>;
export function updateDashboard(pool: ConnectionPool, id: string, updates: Partial<Dashboard>): Promise<Dashboard>;
export function deleteDashboard(pool: ConnectionPool, id: string): Promise<void>;
export function getDashboard(pool: ConnectionPool, id: string): Promise<Dashboard | null>;
export function listDashboards(pool: ConnectionPool, role?: string): Promise<Dashboard[]>;
export function getDefaultDashboard(pool: ConnectionPool, role: string): Promise<Dashboard | null>;
```

### Widget Management

```typescript
export function createWidget(pool: ConnectionPool, widget: Omit<Widget, 'id'>): Promise<Widget>;
export function updateWidget(pool: ConnectionPool, id: string, updates: Partial<Widget>): Promise<Widget>;
export function deleteWidget(pool: ConnectionPool, id: string): Promise<void>;
export function executeWidgetQuery(pool: ConnectionPool, widget: Widget, tenantId?: string): Promise<unknown>;
```

## Behavior Specification

### B-DASH-001: Default Dashboard
**Given** a user with role `app_admin` and a dashboard marked as default for `app_admin`
**When** user navigates to `/admin` (home)
**Then** the default dashboard for their role is displayed

### B-DASH-002: No Dashboard Fallback
**Given** no dashboards are configured
**When** user navigates to `/admin`
**Then** a welcome page is shown with quick-start information

### B-DASH-003: Stat Widget
**Given** a stat widget with query `SELECT COUNT(*) FROM contacts`
**When** the dashboard renders
**Then** the widget displays the count as a formatted number with the widget title

### B-DASH-004: Table Widget
**Given** a table widget with query `SELECT name, email FROM contacts LIMIT 5`
**When** the dashboard renders
**Then** the widget displays a table with 5 rows and columns "Name", "Email"

### B-DASH-005: Chart Widget — Bar
**Given** a bar chart widget with query `SELECT stage AS label, COUNT(*) AS value FROM deals GROUP BY stage`
**When** the dashboard renders
**Then** the widget displays a bar chart with deal stages on X-axis and counts on Y-axis

### B-DASH-006: Dashboard Builder
**Given** an admin user
**When** they access the dashboard builder
**Then** they can add widgets, arrange them on a grid, configure queries, and save

### B-DASH-007: Widget Grid Layout
**Given** a dashboard with 3 widgets: stat (4 cols wide), stat (4 cols), table (12 cols)
**When** the dashboard renders
**Then** two stats are side by side on row 1, table spans full width on row 2

### B-DASH-008: Role-Specific Dashboard
**Given** dashboard A assigned to `app_admin` and dashboard B assigned to `app_viewer`
**When** an `app_viewer` user lists dashboards
**Then** only dashboard B is returned

### B-DASH-009: Tenant-Scoped Widget Data
**Given** tenancy is enabled and widget query is `SELECT COUNT(*) FROM contacts`
**When** widget executes for tenant T
**Then** only tenant T's contacts are counted (RLS enforced)

### B-DASH-010: Widget Query Error
**Given** a widget with an invalid SQL query
**When** the dashboard renders
**Then** the widget shows an error message, other widgets still render

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Widget query fails | DashboardError | DASH_001 | Widget shows error, others unaffected |
| Dashboard not found | DashboardError | DASH_002 | 404 page |
| Invalid widget type | DashboardError | DASH_003 | Throw with widget ID and type |

## Security Considerations

- Widget queries execute with the user's database role (RLS enforced)
- The dashboard builder should only be accessible to `app_admin` role
- SQL queries in widgets must be sanitized — only SELECT queries allowed (no INSERT/UPDATE/DELETE)
- Widget query results must respect column-level grants

## Test Requirements

### Unit Tests
- [ ] Dashboard type validation
- [ ] Widget config validation for each type
- [ ] Grid layout calculation

### Integration Tests
- [ ] `createDashboard()` persists to database
- [ ] `listDashboards()` filters by role
- [ ] `getDefaultDashboard()` returns correct dashboard for role
- [ ] `executeWidgetQuery()` returns query results
- [ ] `executeWidgetQuery()` respects RLS (tenant isolation)
- [ ] `executeWidgetQuery()` rejects non-SELECT queries

### E2E Tests
- [ ] Dashboard renders with widgets
- [ ] Stat widget displays correct value
- [ ] Table widget displays rows
- [ ] Chart widget renders
- [ ] Dashboard builder creates new dashboard

## File Manifest

```
packages/ui/
  src/
    lib/
      dashboards/
        types.ts                # Dashboard, Widget, Layout types
        manager.ts              # CRUD for dashboards and widgets
      components/
        widgets/
          StatWidget.svelte
          TableWidget.svelte
          ChartWidget.svelte
          WidgetContainer.svelte
        DashboardGrid.svelte
        DashboardBuilder.svelte
    routes/
      (app)/
        dashboard/
          +page.svelte          # Default dashboard view
          +page.server.ts
          [slug]/
            +page.svelte        # Named dashboard view
            +page.server.ts
          builder/
            +page.svelte        # Dashboard builder
            +page.server.ts
  tests/
    dashboards/
      manager.test.ts
      widgets.test.ts
```

## Decision References

- ADR-004: SvelteKit — dashboards are SvelteKit pages
- ADR-001: PostgreSQL — widget queries execute against Postgres with RLS
