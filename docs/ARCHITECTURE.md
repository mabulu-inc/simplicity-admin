# SIMPLICITY-ADMIN — System Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Developer                             │
│                                                              │
│   npx simplicity-admin init     npm install + config     middleware │
│        (CLI)                (package)             (embedded) │
└──────────┬──────────────────┬───────────────────────┬───────┘
           │                  │                       │
           ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    @simplicity-admin/core                           │
│        Config System │ Plugin Registry │ Metadata Model      │
│                Provider Interfaces + Defaults                │
└─────────┬──────────┬──────────┬──────────┬──────────────────┘
          │          │          │          │
          ▼          ▼          ▼          ▼
┌─────────┐ ┌───────┐ ┌───────┐ ┌────────┐
│@[proj]/ │ │@[proj]│ │@[proj]│ │@[proj]/│
│  db     │ │ /api  │ │/auth  │ │  ui    │
│         │ │       │ │       │ │        │
│ schema- │ │ Post- │ │ JWT   │ │Svelte- │
│ flow    │ │Graphi-│ │ bcrypt│ │Kit     │
│ intro-  │ │ le V5 │ │ RBAC  │ │Compo-  │
│ spect   │ │ REST  │ │ RLS   │ │nents   │
└────┬────┘ └───┬───┘ └───┬───┘ └───┬────┘
     │          │         │         │
     ▼          ▼         ▼         ▼
┌─────────────────────────────────────────────────────────────┐
│                       PostgreSQL                             │
│    Tables │ RLS Policies │ Grants │ Roles │ Functions        │
└─────────────────────────────────────────────────────────────┘
```

All three consumption modes (CLI scaffold, npm package, middleware) converge on the same `@simplicity-admin/core` engine. The only difference is how the core is instantiated:

- **CLI scaffold**: Generates a project that imports and configures the core
- **npm install**: Developer writes a config file; `npx simplicity-admin dev` loads it
- **Middleware**: Developer calls `createAdmin(config)` which returns an HTTP handler

## 2. Module Dependency Graph

```mermaid
graph TD
    CORE["@simplicity-admin/core<br/>Config, Types, Plugin Registry"]
    DB["@simplicity-admin/db<br/>Introspection, simplicity-schema, Bootstrap"]
    API["@simplicity-admin/api<br/>PostGraphile V5, REST adapter"]
    AUTH["@simplicity-admin/auth<br/>JWT, Middleware, RBAC"]
    UI["@simplicity-admin/ui<br/>SvelteKit, Components, Theming"]
    CLI["@simplicity-admin/cli<br/>init, dev, build, generate"]
    SF["@mabulu-inc/simplicity-schema<br/>Declarative DDL, Migrations"]

    DB --> CORE
    DB --> SF
    API --> CORE
    API --> DB
    AUTH --> CORE
    AUTH --> DB
    UI --> CORE
    CLI --> CORE
    CLI --> DB
    CLI --> API
    CLI --> AUTH
    CLI --> UI
```

**Dependency rules:**
- `core` has ZERO dependencies on other `@simplicity-admin` packages
- `db` depends on `core` + `simplicity-schema`
- `api` depends on `core` + `db` (needs metadata to configure PostGraphile)
- `auth` depends on `core` + `db` (needs user/membership tables)
- `ui` depends on `core` only (communicates with API via HTTP, not direct import)
- `cli` depends on everything (it orchestrates)

## 3. Provider/Adapter Pattern

Every swappable capability follows the same pattern:

### 3a. Interface Definition (in `@simplicity-admin/core`)

```typescript
// packages/core/src/providers/types.ts

export interface Provider<T = unknown> {
  name: string;
  version: string;
  init?(config: ProjectConfig): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface DatabaseProvider extends Provider {
  connect(url: string): Promise<ConnectionPool>;
  introspect(pool: ConnectionPool): Promise<SchemaMeta>;
  migrate(pool: ConnectionPool, config: MigrationConfig): Promise<void>;
}

export interface APIProvider extends Provider {
  createHandler(pool: ConnectionPool, meta: SchemaMeta, config: APIConfig): Promise<HttpHandler>;
}

export interface AuthProvider extends Provider {
  sign(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
  refresh(refreshToken: string): Promise<TokenPair>;
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
}

export interface UIProvider extends Provider {
  createApp(config: UIConfig): Promise<HttpHandler>;
}
```

### 3b. Default Registration

```typescript
// simplicity-admin.config.ts
import { defineConfig } from '@simplicity-admin/core';
import { postgresProvider } from '@simplicity-admin/db';
import { postgraphileProvider } from '@simplicity-admin/api';
import { jwtProvider } from '@simplicity-admin/auth';

export default defineConfig({
  database: process.env.DATABASE_URL,
  // Defaults are auto-registered if not specified:
  // providers: {
  //   database: postgresProvider(),
  //   api: postgraphileProvider(),
  //   auth: jwtProvider(),
  // }
});
```

### 3c. Custom Provider (swap example)

```typescript
import { defineConfig } from '@simplicity-admin/core';
import { myCustomAuth } from './my-auth-provider';

export default defineConfig({
  database: process.env.DATABASE_URL,
  providers: {
    auth: myCustomAuth({ issuer: 'https://auth.example.com' }),
  },
});
```

### 3d. Provider Resolution

1. Check config for explicit provider
2. If not specified, use the default provider for that capability
3. Call `provider.init(config)` during startup
4. Provider is available to all modules via the core registry

## 4. Package Structure (Monorepo)

```
simplicity-admin/
├── package.json              # Root workspace config (private: true)
├── pnpm-workspace.yaml       # Workspace definitions
├── turbo.json                # Turbo task orchestration
├── tsconfig.base.json        # Shared TypeScript config
├── eslint.config.js          # Shared ESLint config
├── vitest.config.ts          # Shared Vitest config
├── compose.yaml              # Docker Compose (Postgres for dev/test)
├── .env.example              # Environment template
├── LICENSE                   # BSL 1.1
│
├── packages/
│   ├── core/
│   │   ├── package.json      # @simplicity-admin/core
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Public API re-exports
│   │       ├── config/
│   │       │   ├── types.ts          # ProjectConfig type
│   │       │   ├── schema.ts         # Zod validation schema
│   │       │   ├── loader.ts         # Config file + env loading
│   │       │   └── defaults.ts       # Default values
│   │       ├── metadata/
│   │       │   ├── types.ts          # TableMeta, ColumnMeta, RelationMeta, EnumMeta
│   │       │   └── column-types.ts   # PG type → ColumnType mapping
│   │       ├── providers/
│   │       │   ├── types.ts          # Provider interfaces
│   │       │   └── registry.ts       # Provider registration + resolution
│   │       └── plugins/
│   │           ├── types.ts          # Plugin interface, lifecycle hooks
│   │           └── manager.ts        # Plugin loading + execution
│   │
│   ├── db/
│   │   ├── package.json      # @simplicity-admin/db
│   │   ├── tsconfig.json
│   │   ├── schema/                   # simplicity-schema YAML (system schema)
│   │   │   ├── tables/
│   │   │   │   ├── users.yaml
│   │   │   │   ├── tenants.yaml
│   │   │   │   └── memberships.yaml
│   │   │   ├── roles/
│   │   │   │   ├── authenticator.yaml
│   │   │   │   ├── anon.yaml
│   │   │   │   ├── app_viewer.yaml
│   │   │   │   ├── app_editor.yaml
│   │   │   │   └── app_admin.yaml
│   │   │   ├── functions/
│   │   │   │   ├── current_user_id.yaml
│   │   │   │   ├── current_tenant_id.yaml
│   │   │   │   └── begin_session.yaml
│   │   │   ├── mixins/
│   │   │   │   ├── timestamps.yaml
│   │   │   │   ├── tenant_scoped.yaml
│   │   │   │   └── auditable.yaml
│   │   │   └── enums/
│   │   └── src/
│   │       ├── index.ts              # Public API re-exports
│   │       ├── connection.ts         # Pool creation + lifecycle
│   │       ├── bootstrap.ts          # System schema creation orchestrator
│   │       └── introspect/
│   │           ├── index.ts          # Full schema introspection orchestrator
│   │           ├── tables.ts         # List tables
│   │           ├── columns.ts        # Column metadata
│   │           ├── relations.ts      # FK → RelationMeta
│   │           └── enums.ts          # Enum discovery
│   │
│   ├── api/
│   │   ├── package.json      # @simplicity-admin/api
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Public API re-exports
│   │       ├── graphql/
│   │       │   ├── preset.ts         # PostGraphile V5 preset
│   │       │   ├── plugins/          # Custom Graphile plugins
│   │       │   └── pg-settings.ts    # JWT → pgSettings for RLS
│   │       ├── rest/
│   │       │   ├── adapter.ts        # REST API adapter
│   │       │   └── openapi.ts        # OpenAPI spec generation
│   │       └── server.ts             # HTTP server (API layer)
│   │
│   ├── auth/
│   │   ├── package.json      # @simplicity-admin/auth
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Public API re-exports
│   │       ├── providers/
│   │       │   └── jwt.ts            # JWT sign/verify/refresh
│   │       ├── middleware.ts         # Auth middleware (extract token, set context)
│   │       ├── password.ts           # bcrypt hash/verify
│   │       ├── rbac/
│   │       │   ├── engine.ts         # Permission resolution (code + DB merge)
│   │       │   └── types.ts          # Permission types
│   │       └── routes/
│   │           ├── login.ts          # POST /auth/login
│   │           ├── logout.ts         # POST /auth/logout
│   │           └── refresh.ts        # POST /auth/refresh
│   │
│   ├── ui/
│   │   ├── package.json      # @simplicity-admin/ui
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── index.ts          # Component re-exports
│   │       │   ├── tokens/           # Design tokens (CSS custom properties)
│   │       │   ├── themes/           # Light/dark themes
│   │       │   └── components/
│   │       │       ├── DataTable.svelte
│   │       │       ├── AutoForm.svelte
│   │       │       ├── Shell.svelte
│   │       │       ├── Sidebar.svelte
│   │       │       └── TopBar.svelte
│   │       └── routes/
│   │           ├── +layout.svelte
│   │           ├── +layout.server.ts
│   │           ├── (auth)/
│   │           │   └── login/+page.svelte
│   │           └── (app)/
│   │               ├── +layout.svelte
│   │               ├── [table]/
│   │               │   ├── +page.svelte          # List view
│   │               │   ├── +page.server.ts
│   │               │   ├── new/+page.svelte      # Create form
│   │               │   └── [id]/+page.svelte     # Edit form
│   │               └── +page.svelte              # Dashboard / home
│   │
│   └── cli/
│       ├── package.json      # @simplicity-admin/cli
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # CLI entry point
│           ├── cli.ts                # Command parser
│           ├── commands/
│           │   ├── init.ts           # Scaffold new project
│           │   ├── dev.ts            # Start dev environment
│           │   ├── build.ts          # Production build
│           │   └── generate.ts       # Generate simplicity-schema YAML from DB
│           ├── templates/            # Scaffold templates (shared)
│           └── starters/             # Starter-specific scaffolds
│               ├── blank/            # Minimal: config + empty schema
│               ├── crm/              # Contacts, deals, activities
│               ├── cms/              # Pages, posts, media, categories
│               └── todo/             # Projects, tasks, labels
│
├── tests/
│   ├── integration/          # Cross-package integration tests
│   └── e2e/                  # Playwright end-to-end tests
│
└── docs/                     # You are here
```

### Developer Project Structure

When a developer scaffolds or creates a project that uses simplicity-admin, their project looks like this:

```
my-admin/
├── package.json                  # @simplicity-admin/* as dependencies
├── simplicity-admin.config.ts    # Config: database, auth, hooks, actions
├── compose.yaml                  # PostgreSQL container
├── .env                          # DATABASE_URL, secrets
├── schema/                       # simplicity-schema YAML (data structure)
│   └── tables/
│       ├── contacts.yaml
│       └── deals.yaml
└── views/                        # View definitions (presentation)
    ├── contacts.view.yaml
    └── deals.view.yaml
```

Schema defines structure. Views define presentation. The config file wires in business logic (hooks, actions). Simplicity-admin is a dependency — the developer's app is its own project.

## 5. Core Engine

### 5a. Config System

Configuration is defined in TypeScript (Zod-validated at load time):

```typescript
// packages/core/src/config/types.ts

export interface ProjectConfig {
  /** PostgreSQL connection URL */
  database: string;

  /** Schema to introspect (default: 'public') */
  schema?: string;

  /** System schema name (default: '_simplicity_admin') */
  systemSchema?: string;

  /** Server port (default: 3000) */
  port?: number;

  /** Base path for admin UI (default: '/admin') */
  basePath?: string;

  /** API configuration */
  api?: {
    /** GraphQL endpoint path (default: '/api/graphql') */
    graphql?: string | false;
    /** REST endpoint path (default: false — disabled unless enabled) */
    rest?: string | false;
    /** Enable GraphiQL in development (default: true) */
    graphiql?: boolean;
  };

  /** Authentication configuration */
  auth?: {
    /** JWT secret (default: auto-generated in dev, required in production) */
    secret?: string;
    /** Access token TTL in seconds (default: 900 = 15 min) */
    accessTokenTTL?: number;
    /** Refresh token TTL in seconds (default: 604800 = 7 days) */
    refreshTokenTTL?: number;
  };

  /** Multi-tenancy configuration */
  tenancy?: {
    /** Enable multi-tenancy (default: false) */
    enabled?: boolean;
    /** How to resolve tenant: 'header' | 'subdomain' | 'path' (default: 'header') */
    resolution?: 'header' | 'subdomain' | 'path';
    /** Header name for tenant resolution (default: 'x-tenant-id') */
    header?: string;
  };

  /** Provider overrides */
  providers?: {
    database?: DatabaseProvider;
    api?: APIProvider;
    auth?: AuthProvider;
    ui?: UIProvider;
  };

  /** Plugin list */
  plugins?: Plugin[];
}
```

**Resolution order** (later overrides earlier):
1. Built-in defaults (defined in `defaults.ts`)
2. Config file (`simplicity-admin.config.ts`)
3. Environment variables (`SIMPLICITY_ADMIN_DATABASE`, `SIMPLICITY_ADMIN_PORT`, etc.)
4. Runtime overrides (passed to `createAdmin()`)

### 5b. Plugin/Hook Lifecycle

```typescript
export interface Plugin {
  name: string;
  version: string;

  /** Called during app initialization, before any providers start */
  onInit?(config: ProjectConfig): Promise<void>;

  /** Called after schema introspection, before API/UI start */
  onSchemaLoaded?(meta: SchemaMeta): Promise<SchemaMeta>;

  /** Called after all providers are ready, before accepting requests */
  onReady?(app: AppContext): Promise<void>;

  /** Called on each incoming request */
  onRequest?(req: Request, ctx: RequestContext): Promise<void>;

  /** Called during graceful shutdown */
  onShutdown?(): Promise<void>;
}
```

**Execution order:** Plugins execute in the order they appear in `config.plugins[]`. Each hook is called sequentially (not parallel) to allow plugins to modify shared state (e.g., `onSchemaLoaded` can transform metadata).

### 5c. Business Logic Layers

The developer decides where and how to implement their business rules. The framework supports three layers — use whichever fits the rule:

| Layer | Mechanism | Best for | Example |
|-------|-----------|----------|---------|
| **Database** | Constraints, triggers, functions, RLS (via simplicity-schema YAML) | Hard invariants that must be enforced regardless of how data enters | `CHECK (price > 0)`, `UNIQUE (email)`, trigger that updates `updated_at` |
| **Code** | Data hooks in `config.hooks` (`validate`, `beforeInsert`, `afterUpdate`, etc.) | Business rules that need application context, external API calls, or complex logic | Validate against a CRM API before insert, send a Slack notification after a deal closes |
| **API** | PostGraphile plugins, REST middleware, GraphQL resolvers | Request-level concerns, computed fields, custom endpoints | Add a computed `fullName` field, rate-limit a specific mutation |

These layers compose — a single operation might hit all three:

```
Client → API (middleware validates auth) → Code (beforeInsert normalizes data)
  → DB (constraint enforces NOT NULL, trigger sets audit fields) → Code (afterInsert sends notification)
```

**Data hooks** are defined per-table in `simplicity-admin.config.ts`:

```typescript
export default defineConfig({
  database: process.env.DATABASE_URL,
  hooks: {
    contacts: {
      validate: async (data, op) => {
        if (!data.email?.includes('@')) throw new ValidationError('Invalid email');
      },
      afterInsert: async (data, ctx) => {
        await notifySlack(`New contact: ${data.first_name}`);
      },
    },
    deals: {
      beforeUpdate: async (data, ctx) => {
        if (ctx.existing.stage === 'closed') {
          throw new ValidationError('Cannot modify closed deals');
        }
        return data;
      },
    },
  },
});
```

**Execution order:** `validate` → `beforeInsert`/`beforeUpdate` → database operation → `afterInsert`/`afterUpdate`. Before-hooks can modify data (return new object) or abort (throw). After-hooks run after commit and do not roll back on failure.

### 5d. Custom Actions

Beyond CRUD, developers can define **custom actions** that appear in the UI when conditions are met. Actions connect the UX directly to business logic with full context.

```typescript
// simplicity-admin.config.ts
export default defineConfig({
  database: process.env.DATABASE_URL,
  actions: {
    orders: [
      {
        name: 'approve',
        label: 'Approve',
        icon: 'check',
        variant: 'success',
        condition: (row) => row.status === 'pending',
        roles: ['app_admin', 'app_editor'],
        confirm: 'Approve this order?',
        handler: async (rows, ctx) => {
          for (const row of rows) {
            await ctx.pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['approved', row.id]);
          }
          return { message: `${rows.length} order(s) approved` };
        },
      },
      {
        name: 'export_invoice',
        label: 'Export Invoice',
        icon: 'file-text',
        placement: ['detail'],
        condition: (row) => row.status === 'approved',
        handler: async ([row], ctx) => {
          const invoiceId = await generateInvoice(row, ctx);
          return { redirect: `/admin/invoices/${invoiceId}` };
        },
      },
    ],
  },
});
```

**How it works:**

1. **Server annotates rows**: On every list/detail query, the server evaluates each action's `condition` and `roles` against the current row and user. Qualifying action names are added to `row._actions`.
2. **UI renders contextually**: DataTable shows action buttons per row (or in the toolbar for bulk actions). AutoForm shows detail actions in the form header. Only actions in `_actions` are rendered.
3. **Execution flow**: User clicks → optional confirmation dialog → `POST /api/actions/:table/:action` → server re-checks condition + RBAC → runs handler → returns result (toast, refresh, or redirect).
4. **Staleness protection**: If data changed between page load and click (e.g., another user already approved), the server returns 409 and the UI refreshes.

The framework never forces business logic into any one layer. DB constraints are the safety net. Code hooks are the business layer. Custom actions are the UX bridge. API plugins are the edge.

## 6. Database Integration

### 6a. Schema-flow Integration

SIMPLICITY-ADMIN uses `@mabulu-inc/simplicity-schema` programmatically (not via CLI) for:
- **Bootstrap**: Creating system tables (users, tenants, memberships) on first run
- **Migration**: Applying system schema changes on framework upgrades
- **Generation**: `npx simplicity-admin generate` delegates to `simplicity-schema generate` to introspect an existing DB and create YAML files

Key simplicity-schema APIs used:
- `runAll(config)` — execute full migration (pre → migrate → post)
- `buildPlan(config)` — preview changes without applying
- `generateFromDb(config)` — introspect DB → generate YAML files
- `scaffoldInit(dir)` — create directory structure

### 6b. DB Introspection Pipeline

The introspection pipeline converts a live PostgreSQL database into the internal metadata model:

```
PostgreSQL → information_schema queries → raw column/table data
  → type mapping (pg type → ColumnType enum)
  → relation resolution (FK → RelationMeta)
  → enum discovery (pg_enum → EnumMeta)
  → SchemaMeta (complete internal model)
```

This metadata model drives everything downstream: PostGraphile schema, UI components, form generation, RBAC enforcement.

### 6c. System vs Application Schema

- **System schema** (`_simplicity_admin`): Owned by the framework. Contains `users`, `tenants`, `memberships`. Managed by simplicity-schema YAML shipped with `@simplicity-admin/db`. Never modified by the developer directly. The underscore prefix signals "framework-owned".
- **Application schema**: Owned by the developer. By default, this is `public` — all business tables live in one schema. Developers who prefer modular, namespaced schemas can configure `schema` to a custom name (e.g., `'crm'`, `'inventory'`) or use multiple schemas by pointing different simplicity-admin instances at different schemas within the same database.

These are separate PostgreSQL schemas. The framework's system tables never collide with the developer's tables regardless of how the developer organizes their application schemas.

## 7. API Layer

### 7a. GraphQL (Default — PostGraphile V5)

PostGraphile V5 auto-generates a complete, spec-compliant GraphQL API from PostgreSQL:

- **Schema generation**: Tables → query + mutation types, columns → fields, FKs → nested connections
- **Pagination**: Relay-style cursor pagination + simple limit/offset
- **Filtering**: Conditions on every column (eq, neq, gt, lt, like, in, isNull, etc.)
- **Ordering**: Multi-column ordering
- **Mutations**: Create, update, delete for every table
- **Subscriptions**: Real-time updates (when enabled)
- **RLS integration**: JWT claims set as `pgSettings` so RLS policies are enforced at the DB level

Custom behavior is added via Graphile plugins (in `packages/api/src/graphql/plugins/`), not by reimplementing PostGraphile features.

**Configuration:**
```typescript
api: {
  graphql: '/api/graphql',  // or false to disable
  graphiql: true,            // GraphiQL IDE in dev mode
}
```

### 7b. REST (Optional)

When enabled, a REST adapter translates metadata into RESTful endpoints:

```
GET    /api/rest/:table          → list (paginated, filterable)
GET    /api/rest/:table/:id      → single record
POST   /api/rest/:table          → create
PATCH  /api/rest/:table/:id      → update
DELETE /api/rest/:table/:id      → delete
```

Auto-generates an OpenAPI 3.0 spec at `/api/rest/openapi.json`.

**Configuration:**
```typescript
api: {
  rest: '/api/rest',  // or false to disable (default)
}
```

### 7c. Swapping the API Provider

```typescript
import { defineConfig } from '@simplicity-admin/core';
import { myCustomAPI } from './my-api';

export default defineConfig({
  database: process.env.DATABASE_URL,
  providers: {
    api: myCustomAPI(),
  },
});
```

The custom provider must implement the `APIProvider` interface: `createHandler(pool, meta, config) → HttpHandler`.

## 8. Admin UI Architecture

### 8a. SvelteKit Application

The admin UI is a SvelteKit application that:
- Communicates with the API layer via HTTP (GraphQL queries/mutations)
- Is metadata-driven: the UI reads `SchemaMeta` + `ViewDefinition` and renders components dynamically
- Ships as a library package (`@simplicity-admin/ui`) that can be embedded or run standalone

### 8b. View Layer

The view layer controls how data is presented. Four tiers, each building on the last:

1. **Auto-generated defaults** — framework introspects schema + relations to produce smart list and detail views with zero config. Detail views include field sections and related data (e.g., viewing a team shows its roster, upcoming games, and past games). List views auto-select appropriate columns (text, number, date — not JSON blobs).
2. **Developer view definitions** (`views/*.view.yaml`) — YAML files that customize layouts, sections, related data display, filter presets, and field presentation. Separate from simplicity-schema YAML (schema = structure, views = presentation). Version-controlled and deployed.
3. **Admin view overrides** (runtime UI) — admins drag/drop sections, hide/show columns, reorder fields. Stored in `_simplicity_admin.view_overrides`. Portable between environments via `npx simplicity-admin env export/import`.
4. **User saved views** (personal) — users save their own column picks, filters, sort orders, and layout preferences. Nameable, shareable within tenant. Not subject to managed porting.

Resolution order: auto-default ← developer YAML ← admin override ← user saved view. Admin overrides set a ceiling that user views cannot exceed (same principle as RBAC).

### 8c. Component Hierarchy

```
Shell
├── TopBar (user menu, role switcher, tenant switcher, notifications bell)
├── Sidebar (role-filtered navigation — rebuilds on role switch)
└── Content Area
    ├── ViewPicker (saved view selector)
    ├── Dashboard (widgets grid)
    ├── ListView (DataTable + filter presets + pagination + actions)
    ├── DetailView (sections: fields + relations + custom + actions)
    ├── ViewCustomizer (admin-only overlay for drag/drop customization)
    └── Settings (permissions, workflow, notifications)
```

### 8d. Metadata-Driven Rendering

Components receive `ColumnMeta[]` and render appropriate UI:

| ColumnType | Component |
|-----------|-----------|
| `text`, `varchar` | TextInput |
| `integer`, `numeric`, `decimal` | NumberInput |
| `boolean` | Toggle |
| `enum` | Select (dropdown with enum values) |
| `date` | DatePicker |
| `timestamp`, `timestamptz` | DateTimePicker |
| `uuid` (FK) | RelationPicker (searchable select) |
| `json`, `jsonb` | JSONEditor |
| `text[]` | TagInput |

### 8d. Theming

Design tokens (CSS custom properties) define the visual language:

```css
/* Light theme (default) */
:root {
  --color-primary: #3b82f6;
  --color-surface: #ffffff;
  --color-text: #1f2937;
  --radius-md: 0.375rem;
  --space-4: 1rem;
  /* ... */
}
```

Themes are swappable via config or at runtime. Light and dark themes ship by default.

## 9. Authentication Flow

```
1. User submits email/password to POST /auth/login
2. Auth middleware validates credentials against users table (bcrypt verify)
3. On success: generates JWT access token + refresh token
4. JWT payload: { user_id, tenant_id, roles[], activeRole }
5. Client stores tokens (httpOnly cookie for access, separate for refresh)
6. On each request:
   a. Auth middleware extracts JWT from Authorization header or cookie
   b. Verifies signature + expiry
   c. Sets pgSettings: role → activeRole (functional DB role), user_id, tenant_id, is_super_admin
   d. PostGraphile uses pgSettings for RLS enforcement
7. Token refresh: POST /auth/refresh with refresh token → new token pair
8. Role switch: POST /auth/switch-role with { role } → new token pair with updated activeRole
9. Tenant switch: POST /auth/switch-tenant with { tenantId } → new token pair with updated tenantId and tenant-scoped roles
10. Logout: POST /auth/logout → invalidate refresh token
```

## 10. Authorization Architecture

### 10a. Three Layers

1. **Database roles** (PostgreSQL): `anon`, `app_viewer`, `app_editor`, `app_admin`, `authenticator`
2. **Grants** (table + column level): Defined in simplicity-schema YAML, applied to database
3. **RLS policies**: Row-level filtering based on `current_setting('app.user_id')` and `current_setting('app.tenant_id')`

### 10b. Code-First Permissions (simplicity-schema YAML)

```yaml
# schema/tables/contacts.yaml
table: contacts
use: [tenant_scoped, timestamps]
rls: true
force_rls: true

columns:
  - name: id
    type: uuid
    primary_key: true
    default: gen_random_uuid()
  - name: first_name
    type: text
  - name: last_name
    type: text
  - name: email
    type: text
  - name: salary
    type: numeric
    comment: "Restricted to admin role only"

grants:
  - to: app_viewer
    privileges: [SELECT]
    columns: [id, first_name, last_name, email]  # No salary!
  - to: app_editor
    privileges: [SELECT, INSERT, UPDATE]
    columns: [id, first_name, last_name, email]  # No salary!
  - to: app_admin
    privileges: [SELECT, INSERT, UPDATE, DELETE]
    # All columns (no restriction)

policies:
  - name: contacts_tenant_isolation
    for: ALL
    using: "tenant_id = current_setting('app.tenant_id')::uuid OR current_setting('app.is_super_admin', true)::boolean = true"
```

### 10c. Multi-Role Users

A user may hold multiple database roles (e.g., `app_admin` + `app_editor`). The JWT carries all assigned roles in `roles[]` and a single `activeRole` that drives current access:

- **Login**: All roles for the user (within the current tenant) are loaded into the JWT. The highest-privilege role is set as `activeRole` by default.
- **Role switching**: `POST /auth/switch-role` issues a new token pair with the requested role as `activeRole`. The UI reloads navigation, table columns, and form fields to match the new role's permissions.
- **pgSettings**: Only `activeRole` is set as the PostgreSQL session role — grants and RLS always enforce the single active role, never a union.
- **Single-role users**: The role switcher UI is hidden; the user's one role is automatically active.

### 10c-ii. Super-Admins

Super-admins are system-level administrators identified by a `super_admin: boolean` flag on the user record. They operate outside the normal tenant membership model:

- **No membership required**: Super-admins can switch to any tenant without an explicit membership. They always operate as `app_admin` in any tenant.
- **Global mode**: Super-admins can enter a "global" context (`tenantId: null`) where tenant RLS is bypassed, allowing cross-tenant data visibility. The DataTable automatically prepends a "Tenant" column in global mode.
- **RLS exception**: The `tenant_scoped` mixin's RLS policy includes a super-admin clause: `tenant_id = current_setting('app.tenant_id')::uuid OR current_setting('app.is_super_admin', true)::boolean = true`. This only activates when the auth middleware sets `app.is_super_admin` — it cannot be spoofed by user input.
- **Bootstrap default**: The default admin created during bootstrap (`admin@localhost`) is a super-admin.
- **UI**: The tenant switcher shows all tenants plus a "Global" option. A visual indicator distinguishes global mode from tenant-scoped mode.

### 10d. UI Permission Layer

The admin UI reads effective permissions for the **active role** (code + DB) and:
- Hides columns the active role cannot SELECT
- Disables edit on columns the active role cannot UPDATE
- Hides create/delete buttons if INSERT/DELETE is not granted
- Filters navigation to only show tables the active role can SELECT
- Shows a role switcher in the TopBar when the user has multiple roles

Admins can further restrict (never expand) via the permissions UI. These overrides are stored in a system table and merged at runtime.

## 11. Multi-Tenancy

### 11a. Architecture

Multi-tenancy uses row-level isolation with a `tenant_id` column:

- The `tenant_scoped` mixin adds `tenant_id` + RLS policy to any table
- Tenant is resolved from the request (header, subdomain, or path — configurable)
- `current_setting('app.tenant_id')` is set via pgSettings on every request
- RLS policy: `tenant_id = current_setting('app.tenant_id')::uuid`

### 11b. Invisible When Disabled

When `tenancy.enabled` is `false` (default):
- No `tenant_id` column is expected on application tables
- No tenant resolution middleware runs
- No tenant switcher appears in the UI
- System tables still have `tenant_id` but a single default tenant is created automatically
- The developer never sees or thinks about tenancy

When `tenancy.enabled` is `true`:
- Application tables using the `tenant_scoped` mixin get tenant isolation
- Tenant switcher appears in the UI top bar
- Tenant resolution middleware runs on every request
- User memberships are tenant-scoped (different roles per tenant)

## 12. Data Flow — Full Request Lifecycle

```
Browser
  │
  ├─── GET /admin/contacts ──────────────────────────────┐
  │                                                       │
  ▼                                                       │
SvelteKit Route Handler                                   │
  │ +page.server.ts load()                                │
  │                                                       │
  ├─── GraphQL query ────────────────────────────────┐    │
  │    { contacts(first: 25) { id, name, email } }   │    │
  │                                                   │    │
  ▼                                                   │    │
Auth Middleware                                       │    │
  │ Extract JWT from cookie/header                    │    │
  │ Verify signature + expiry                         │    │
  │ Set pgSettings: role, user_id, tenant_id          │    │
  │                                                   │    │
  ▼                                                   │    │
PostGraphile V5                                       │    │
  │ Parse GraphQL query                               │    │
  │ Generate SQL with RLS context                     │    │
  │                                                   │    │
  ▼                                                   │    │
PostgreSQL                                            │    │
  │ SET LOCAL role TO 'app_viewer';                    │    │
  │ SET LOCAL app.user_id TO '...';                    │    │
  │ SET LOCAL app.tenant_id TO '...';                  │    │
  │ SELECT id, name, email FROM contacts              │    │
  │   WHERE tenant_id = current_setting(...)::uuid    │    │
  │   -- RLS automatically filters rows               │    │
  │   -- Column grants enforce column access           │    │
  │                                                   │    │
  ▼                                                   │    │
  Result rows ───────────────────────────────────────►│    │
                                                      │    │
  GraphQL JSON response ◄────────────────────────────┘    │
                                                           │
  Rendered HTML (DataTable) ◄──────────────────────────────┘
  │
  ▼
Browser (rendered list view)
```

## 13. Security Architecture

### 13a. Authentication Security

- **JWT secrets**: Must be at least 32 characters in production; the application refuses to start with the default `'development-secret'` when `NODE_ENV=production`
- **Password hashing**: bcrypt with cost factor 12; timing-safe login prevents user enumeration
- **Token lifecycle**: 15-minute access tokens, 7-day refresh tokens with single-use rotation
- **Token revocation**: Database-backed (SHA-256 hashed) revocation store survives restarts and works across instances

### 13b. Authorization Enforcement

RBAC is enforced at **three independent layers** — all must agree:

1. **PostgreSQL grants + RLS**: Database-level enforcement via `SET LOCAL role` and row-level security policies
2. **Server-side action guards**: Every SvelteKit form action (create, update, delete, transition) checks RBAC permissions before executing. UI button visibility is a convenience, not a security boundary.
3. **UI permission layer**: Hides inaccessible elements; can further restrict (never expand) code-defined permissions

### 13c. Input Validation

- **SQL identifiers**: All table/column names interpolated into SQL use `escapeIdentifier()` from `@simplicity-admin/db`
- **SQL values**: All values use parameterized queries (`$1`, `$2`) — never interpolated
- **Request bodies**: Size-limited (default 1 MB) to prevent memory exhaustion
- **Error responses**: Database errors are sanitized before returning to clients; no internal schema details leaked

### 13d. API Protection

- **Rate limiting**: Auth endpoints (login, refresh) are rate-limited per IP (configurable)
- **GraphQL depth limiting**: Queries exceeding configurable max depth (default: 10) are rejected
- **GraphiQL**: Disabled by default; explicitly enabled by the CLI `dev` command for development

### 13e. Security Headers

All responses include: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. HSTS is added in production.

### 13f. Production Deployment Checklist

1. Set `SIMPLICITY_ADMIN_AUTH_SECRET` to a cryptographically random string (≥32 chars)
2. Set `NODE_ENV=production`
3. Change the default admin password (`admin@localhost` / `changeme`)
4. Use strong, unique database credentials (not the compose.yaml defaults)
5. Ensure `graphiql` is not explicitly set to `true`
6. Run behind a reverse proxy with TLS termination
7. Restrict PostgreSQL port access to application hosts only

## 14. Testing Architecture

### 14a. Test Tiers

| Tier | Location | Requires | Runner |
|------|----------|----------|--------|
| Unit | `packages/*/tests/*.test.ts` | Nothing | Vitest |
| Integration | `tests/integration/*.test.ts` | Real Postgres (Docker) | Vitest |
| E2E | `tests/e2e/*.spec.ts` | Full running stack | Playwright |

### 14b. Test Database

`compose.yaml` provides a PostgreSQL container for development and testing:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: project_dev
    ports:
      - "5432:5432"
```

Test connection: `postgres://admin:admin@localhost:5432/project_dev`

### 14c. Test Utilities

`@simplicity-admin/core` exports test utilities:

```typescript
import { createTestPool, seedTestData, cleanupTestData } from '@simplicity-admin/core/testing';
```

### 14d. TDD Workflow

Every feature follows red/green TDD:
1. Write a failing test that describes the expected behavior
2. Run the test — confirm it fails (red)
3. Write the minimum implementation to make it pass
4. Run the test — confirm it passes (green)
5. Refactor if needed (keeping tests green)
6. Run full suite to check for regressions
