# SIMPLICITY-ADMIN — Product Requirements Document

## 1. Vision

**One-liner:** A packaged dependency that gives any developer a fully functional, production-grade back-office admin suite by pointing it at a database.

Building admin backends is repetitive, time-consuming grunt work that every application needs but none can afford to get wrong. Authentication, authorization, CRUD, dashboards, workflow, notifications — developers rebuild these same patterns for every project, poorly, because they're focused on their app's differentiators.

SIMPLICITY-ADMIN solves this by shipping as a dependency that "just works" with great defaults. Give it a database connection and you have a complete admin panel with authentication, column-level RBAC, auto-generated CRUD, dashboards, workflow automation, and notifications. Every capability is first-class but invisible until needed — a solo developer building a simple tool sees no complexity, while a team building a multi-tenant SaaS gets enterprise-grade access control without changing a single line of config.

The framework is modular by design. Every layer — database, API, UI, authentication, authorization — exposes a provider interface with an excellent default implementation that can be swapped without touching the rest of the system. PostgreSQL with PostGraphile is the default, but nothing prevents adapting to MySQL or a custom GraphQL server. SvelteKit is the default UI, but the API layer works headlessly for any frontend.

## 2. Design Principles

These are immutable. Every decision must be validated against them.

1. **Zero-config to start, fully customizable at every layer.** A developer with a database URL should have a working admin panel in under 5 minutes. No boilerplate, no ceremony. But every default must be overridable.

2. **The database schema IS the source of truth.** Tables become CRUD views. Columns become form fields. Foreign keys become relations. Enums become dropdowns. The admin panel is a reflection of the schema, not a parallel definition of it.

3. **Every default is swappable via the provider pattern.** PostgreSQL, PostGraphile, SvelteKit, JWT — these are excellent defaults, not hard dependencies. A TypeScript interface defines each capability; the default implementation can be replaced by providing an alternative in config.

4. **Every capability is first-class but invisible until needed.** Multi-tenancy, column-level RBAC, workflow, notifications — all architecturally present from day one, but contribute zero complexity or clutter when not configured. The simplest use case should feel like the product was built just for that use case.

5. **Security is PostgreSQL-native.** Row-Level Security policies, database roles, and column-level grants are the enforcement mechanism — not application-layer middleware that can be bypassed. The database is the last line of defense.

6. **AI-native development.** The project is built to be developed, extended, and maintained by AI coding assistants. Documentation is structured for stateless AI loops (Ralph Loop). Specs are unambiguous. Tasks are self-contained. The project should be easily discoverable and usable by AI when developers are vibe-coding.

7. **Minimal dependencies — own your stack.** Every dependency must earn its place. Prefer standard APIs over libraries. The framework should be light enough to embed anywhere without bloating the host application.

## 3. Target Personas

### Solo Developer (Alex)
Alex is building a SaaS product. They need an admin panel yesterday. They don't have time to build auth, RBAC, or CRUD from scratch. They want to run one command, point it at their database, and have a working admin UI. They'll customize later — right now they need to ship.

### Team Lead (Jordan)
Jordan manages a team of 8 building an internal business tool. They need role-based access control so sales can't see HR data. They need audit trails. They need multi-tenancy because they serve 50 clients. They want to define permissions in code (version-controlled) but let department heads customize further via the UI.

### Platform Engineer (Morgan)
Morgan is embedding the admin panel into an existing Express/Fastify application. They don't want a separate process — they want middleware they can mount at `/admin`. They need to integrate with their existing auth system (OIDC). They want to use their own build pipeline.

### Business Admin (Taylor)
Taylor is non-technical. They use the admin UI daily to manage data, configure dashboards, set up notification rules, and define approval workflows. They never touch code. The UI must be intuitive, responsive, and fast.

## 4. Consumption Modes

### 4a. CLI Scaffold (Fastest start)
```bash
npx simplicity-admin init my-admin
cd my-admin
# Edit simplicity-admin.config.ts with your DATABASE_URL
npm run dev
```
Generates a complete starter project with config file, Docker Compose for Postgres, and a dev script. Running `npm run dev` bootstraps the database (creates system tables via simplicity-schema) and launches the admin UI.

### 4b. npm install + config (Existing project)
```bash
npm install @mabulu-inc/simplicity-admin-core @mabulu-inc/simplicity-admin-db @mabulu-inc/simplicity-admin-api @mabulu-inc/simplicity-admin-auth @mabulu-inc/simplicity-admin-ui
```
```typescript
// simplicity-admin.config.ts
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';

export default defineConfig({
  database: process.env.DATABASE_URL,
});
```
```bash
npx simplicity-admin dev
```

### 4c. Embeddable Middleware (Full control)
```typescript
import express from 'express';
import { createAdmin } from '@mabulu-inc/simplicity-admin-core';

const app = express();

app.use('/admin', createAdmin({
  database: process.env.DATABASE_URL,
}));

app.listen(3000);
```
Mounts the full admin suite (API + UI) at the specified path. Works with Express, Fastify, Koa, or any Node.js HTTP framework.

## 5. Milestone Requirements

### M1: Foundation (v0.1.0)

**Goal:** A developer can scaffold a project, point it at a Postgres database, and get a working admin panel with authentication and auto-generated CRUD.

#### US-001: Project Scaffolding
**As a** developer, **I want to** run `npx simplicity-admin init my-admin` **so that** I get a working starter project with sensible defaults.

- AC-001a: Command creates a directory with package.json, config file, Docker Compose, and dev script
- AC-001b: `npm install && npm run dev` starts a working admin panel on localhost
- AC-001c: Generated config file is documented with comments explaining each option
- AC-001d: Schema-flow system schema YAML files are included for the framework's own tables

#### US-002: Database Connection + Introspection
**As a** developer, **I want to** provide a database URL and have SIMPLICITY-ADMIN introspect the schema **so that** I don't have to manually define my data model.

- AC-002a: Connecting to an existing Postgres DB introspects all user tables, columns, types, relations, and enums
- AC-002b: System tables (users, tenants, memberships) are created automatically via simplicity-schema if they don't exist
- AC-002c: Introspection produces an internal metadata model that drives CRUD, forms, and API generation
- AC-002d: Re-running introspection detects schema changes
- AC-002e: Developer can generate simplicity-schema YAML files from their existing DB at any time via `npx simplicity-admin generate`

#### US-003: Authentication
**As a** user, **I want to** log in with email and password **so that** I can access the admin panel securely.

- AC-003a: Login page is the default route for unauthenticated users
- AC-003b: Valid credentials return a JWT access token + refresh token
- AC-003c: Invalid credentials return a clear error message (not a stack trace)
- AC-003d: JWT is validated on every request; expired tokens redirect to login
- AC-003e: Refresh tokens allow seamless re-authentication without re-entering credentials
- AC-003f: Logout invalidates the refresh token
- AC-003g: Passwords are hashed with bcrypt (cost factor 12+)

#### US-004: Auto-Generated List Views
**As a** user, **I want to** see a list view for each table in my database **so that** I can browse and manage records.

- AC-004a: Each table gets a list view accessible via sidebar navigation
- AC-004b: List view displays columns with appropriate formatting (dates, booleans, enums, etc.)
- AC-004c: List view supports pagination (configurable page size, default 25)
- AC-004d: List view supports column sorting (click header to sort, click again to reverse)
- AC-004e: List view supports basic filtering (text search, enum dropdown, date range)
- AC-004f: Foreign key columns display the referenced record's display name, not the raw ID
- AC-004g: Empty tables show a helpful "No records yet" message with a create button

#### US-005: Auto-Generated Forms (Create/Edit/Delete)
**As a** user, **I want to** create, edit, and delete records **so that** I can manage my data through the admin UI.

- AC-005a: Each table has a "New" button that opens a create form
- AC-005b: Form fields are generated from column metadata (text input, number input, toggle, select, date picker, etc.)
- AC-005c: Required fields are marked and validated before submission
- AC-005d: Foreign key fields render as searchable select dropdowns
- AC-005e: Enum fields render as select dropdowns with the enum values
- AC-005f: Clicking a row in the list view opens the edit form with current values
- AC-005g: Edit form has a delete button with confirmation dialog
- AC-005h: Successful create/edit/delete shows a toast notification and returns to list view

#### US-006: Auto-Generated GraphQL API
**As a** developer, **I want** SIMPLICITY-ADMIN to auto-generate a GraphQL API from my database **so that** I can query and mutate data programmatically.

- AC-006a: PostGraphile V5 generates a complete GraphQL schema from the database
- AC-006b: GraphQL endpoint is available at `/api/graphql` (configurable)
- AC-006c: GraphiQL or similar IDE is available in development mode
- AC-006d: Queries, mutations, subscriptions work for all user tables
- AC-006e: Pagination, filtering, and ordering are supported via PostGraphile's built-in plugins

#### US-007: Dev Server
**As a** developer, **I want to** run `npx simplicity-admin dev` **so that** I get a hot-reloading development environment.

- AC-007a: Starts the API server (PostGraphile) and admin UI (SvelteKit)
- AC-007b: Bootstraps the database if needed (runs simplicity-schema migrations)
- AC-007c: Hot-reloads on config file changes
- AC-007d: Displays clear startup banner with URLs for UI, API, and GraphiQL

### M2: Access Control (v0.2.0)

**Goal:** Developers can define column-level RBAC via code (simplicity-schema YAML), admins can further customize permissions via the UI, and navigation adapts to user roles.

#### US-008: Role-Based Access Control (RBAC)
**As a** developer, **I want to** define roles and permissions in simplicity-schema YAML **so that** access control is version-controlled and enforced at the database level.

- AC-008a: Roles are defined in simplicity-schema YAML (`schema/roles/*.yaml`)
- AC-008b: Table-level permissions (SELECT, INSERT, UPDATE, DELETE) are defined via `grants` in table YAML
- AC-008c: Column-level permissions are defined via `grants.columns` in table YAML
- AC-008d: RLS policies are defined via `policies` in table YAML
- AC-008e: Running simplicity-schema applies all grants, policies, and RLS settings to the database
- AC-008f: The admin UI respects all permissions — hidden columns are not visible, denied actions are disabled

#### US-009: UI Permission Management
**As an** admin, **I want to** customize permissions via the admin UI **so that** I can adapt access control without code changes.

- AC-009a: Permissions UI shows a matrix of roles × tables × operations
- AC-009b: Admins can restrict permissions (remove access) but never exceed code-defined ceiling
- AC-009c: Column-level visibility/editability can be toggled per role per table
- AC-009d: Permission changes take effect immediately (no restart required)
- AC-009e: UI-defined permissions are stored in the database and merged with code-defined permissions at runtime

#### US-010: Role-Based Navigation
**As a** user, **I want to** see only the menu items relevant to my role **so that** the interface isn't cluttered with things I can't access.

- AC-010a: Sidebar navigation items are filtered by the current user's role permissions
- AC-010b: Tables the user has no SELECT permission on are hidden from navigation
- AC-010c: Navigation can be customized via config (grouping, ordering, icons, labels)
- AC-010d: Navigation groups can be collapsed/expanded
- AC-010e: Default navigation is auto-generated from the schema (one item per table, alphabetical)

### M3: Intelligence (v0.3.0)

**Goal:** Admins can build custom dashboards and configure notification rules without code.

#### US-011: Custom Dashboards
**As an** admin, **I want to** create dashboards with widgets **so that** I can visualize key metrics and data.

- AC-011a: Dashboard builder is accessible from the admin UI
- AC-011b: Available widgets: stat card (single number), table (query results), chart (bar, line, pie)
- AC-011c: Widgets are powered by database queries (written in SQL or configured via UI)
- AC-011d: Dashboards can be assigned to specific roles (role-based dashboards)
- AC-011e: A dashboard can be set as the landing page for a role
- AC-011f: Dashboard layout is drag-and-drop grid-based
- AC-011g: Dashboard configurations are stored in the database

#### US-012: Notification System
**As an** admin, **I want to** configure notifications on data events **so that** users are alerted when important things happen.

- AC-012a: Notification rules can be created via the admin UI
- AC-012b: Triggers: record created, record updated, field changed to value, scheduled (cron)
- AC-012c: Channels: in-app notification bell, email (SMTP provider swappable)
- AC-012d: Notification templates support variable interpolation (record fields)
- AC-012e: Users can view and dismiss in-app notifications
- AC-012f: Notification preferences per user (opt-in/opt-out per channel)

### M4: Automation (v0.4.0)

**Goal:** Developers and admins can define workflow state machines and event-driven automations.

#### US-013: Workflow State Machines
**As a** developer, **I want to** define state machines for record lifecycle **so that** records follow predictable approval flows.

- AC-013a: States are defined per table (e.g., draft → review → approved → published)
- AC-013b: Transitions define which role can move between states
- AC-013c: Transition guards: conditions that must be true for a transition to occur
- AC-013d: Transition hooks: actions triggered on state change (send notification, update field, call webhook)
- AC-013e: State is stored as a column on the record (developer chooses which column)
- AC-013f: UI shows current state with available transitions as action buttons
- AC-013g: State machine definitions can be in config (code-first) or managed via admin UI
- AC-013h: Audit trail of all state transitions (who, when, from state, to state, comment)

#### US-014: Event-Driven Automation
**As a** developer, **I want to** trigger actions on data events **so that** I can automate repetitive business logic.

- AC-014a: Event types: onCreate, onUpdate, onDelete, onFieldChange, onSchedule
- AC-014b: Conditions: if/else logic on record fields (e.g., if status = 'urgent')
- AC-014c: Actions: send email, call webhook (HTTP POST), update record, create record
- AC-014d: Automations can be chained (action A triggers event B)
- AC-014e: Execution log with status, timing, and error details
- AC-014f: Automations can be paused/disabled without deleting them
- AC-014g: Automations defined in config (code-first) or via admin UI

## 6. Non-Functional Requirements

### Performance
- NFR-001: Admin UI initial load < 2 seconds on broadband
- NFR-002: List view with 1000 records renders in < 500ms
- NFR-003: CRUD operations complete in < 200ms (excluding network)
- NFR-004: Schema introspection of 100-table database completes in < 5 seconds

### Security
- NFR-005: All authentication tokens are signed and verified (never trust client)
- NFR-006: SQL injection is impossible (parameterized queries only)
- NFR-007: RBAC is enforced at the database level (RLS + grants), not just the UI
- NFR-008: No secrets in client-side code or config files committed to version control
- NFR-009: OWASP Top 10 compliance

### Testing
- NFR-010: Minimum 80% code coverage across all packages
- NFR-011: All tests use real PostgreSQL (no mocking DB or GraphQL)
- NFR-012: Red/green TDD for all features (test written before implementation)

### Accessibility
- NFR-013: Admin UI meets WCAG 2.1 AA standards
- NFR-014: All interactive elements are keyboard-navigable
- NFR-015: Screen reader compatible (semantic HTML, ARIA labels)

### Developer Experience
- NFR-016: Zero-config start in under 5 minutes
- NFR-017: Clear, actionable error messages (never raw stack traces in production)
- NFR-018: TypeScript-first with full type inference (no `any` leaking to consumers)

## 7. Licensing

SIMPLICITY-ADMIN is licensed under the **Business Source License (BSL 1.1)**.

- **Free for**: non-production use, internal tools, evaluation, development, testing
- **Paid license required for**: production commercial use (SaaS, hosted services, commercial products serving external users)
- **Change date**: 4 years from each release — after which the code converts to Apache 2.0
- **Additional use grant**: Companies with fewer than [N] employees may use in production without a paid license (threshold TBD)

## 8. Glossary

| Term | Definition |
|------|-----------|
| **Provider** | A swappable implementation of a capability (e.g., AuthProvider, DatabaseAdapter). Defined as a TypeScript interface in `@mabulu-inc/simplicity-admin-core`. |
| **Functional role** | A database role representing a permission level (e.g., `app_admin`, `app_editor`, `app_viewer`). Not tied to individual users — users are assigned to roles via memberships. |
| **Tenant** | An isolated workspace within the application. All data is scoped to a tenant via `tenant_id` foreign keys and RLS policies. Invisible if multi-tenancy is not configured. |
| **Membership** | The association of a user to a tenant with a specific role. A user can be a member of multiple tenants with different roles. |
| **Mixin** | A reusable schema pattern in simplicity-schema (e.g., `timestamps`, `tenant_scoped`, `auditable`). Applied to tables via `use: [mixin_name]` in YAML. |
| **simplicity-schema** | `@mabulu-inc/simplicity-schema` — declarative PostgreSQL migration tool that defines schema as YAML files. Supports tables, columns, enums, mixins, RLS policies, grants, triggers, functions, and views. |
| **System schema** | Database objects owned by SIMPLICITY-ADMIN (users, tenants, memberships, roles). Managed via simplicity-schema YAML shipped with the framework. |
| **Application schema** | Database objects owned by the developer's application. Introspected by SIMPLICITY-ADMIN to generate CRUD, API, and UI. |
| **Ralph Loop** | AI development methodology: stateless while loop where each iteration reads specs, picks a task, does TDD, commits, and resets context. |
| **Code ceiling** | RBAC principle: permissions defined in code (simplicity-schema YAML) set the maximum access level. UI-based customization can further restrict but never exceed this ceiling. |
| **Metadata model** | Internal representation of the database schema (tables, columns, relations, enums) that drives CRUD generation, form rendering, and API schema. |
| **Design tokens** | CSS custom properties that define the visual language (colors, spacing, typography). Swappable via themes. |
