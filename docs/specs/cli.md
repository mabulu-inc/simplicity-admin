# CLI Module Specification

**PRD Reference:** §4, §5 (US-001, US-007)

## Overview

The CLI module (`@mabulu-inc/simplicity-admin-cli`) provides the command-line interface for scaffolding projects, running the development server, building for production, and generating schema files. It is the primary entry point for developers using the framework.

## Package Location

- Package: `@mabulu-inc/simplicity-admin-cli`
- Source: `packages/cli/src/`
- Tests: `packages/cli/tests/`

## Dependencies

- `@mabulu-inc/simplicity-admin-core` — config loader
- `@mabulu-inc/simplicity-admin-db` — bootstrap, simplicity-schema integration
- `@mabulu-inc/simplicity-admin-api` — API server
- `@mabulu-inc/simplicity-admin-auth` — auth setup
- `@mabulu-inc/simplicity-admin-ui` — UI server

## Public API

### CLI Commands

```
npx simplicity-admin init [dir] [--starter <name>]  # Scaffold new project (starters: blank, crm, cms, todo)
npx simplicity-admin dev                 # Start development server
npx simplicity-admin build               # Build for production
npx simplicity-admin start               # Start production server
npx simplicity-admin generate            # Generate simplicity-schema YAML from existing DB
npx simplicity-admin migrate             # Run simplicity-schema migrations
npx simplicity-admin env export [--output <file>]  # Export admin overrides + runtime config
npx simplicity-admin env import [--input <file>]   # Import admin overrides into target env
npx simplicity-admin --help              # Show help
npx simplicity-admin --version           # Show version
```

### Programmatic API

```typescript
// packages/cli/src/index.ts

export function createAdmin(config: Partial<ProjectConfig>): HttpHandler;
export function startServer(config: Partial<ProjectConfig>): Promise<Server>;
```

These are for the middleware consumption mode — developers who want to embed SIMPLICITY-ADMIN in their own server.

## Behavior Specification

### B-CLI-001: Init — Quick Start with Defaults
**Given** a user runs `npx simplicity-admin init my-admin`
**When** the command starts interactively (TTY detected)
**Then** the FIRST prompt is:
```
Use defaults? (blank starter, port 3000, Postgres via Docker) [Y/n]
All defaults can be changed later in simplicity-admin.config.ts.
```
If the user accepts (Y or Enter), scaffolding proceeds immediately with the blank starter — no further prompts.

### B-CLI-001b: Init — Interactive Customization
**Given** user answers "n" to the defaults prompt
**When** the interactive flow continues
**Then** prompts in sequence:
1. "Choose a starter: blank, crm, cms, todo" (default: blank)
2. "Port?" (default: 3000)
3. "Database URL?" (default: postgres://localhost:5432/my-admin)
Each prompt shows its default in brackets. Pressing Enter accepts the default.

### B-CLI-001c: Init — Non-Interactive (CI)
**Given** a user runs `npx simplicity-admin init my-admin` in a non-TTY environment (e.g., CI)
**When** the command executes
**Then** uses all defaults (blank starter) with no prompts — equivalent to accepting defaults

### B-CLI-001d: Init — Named Starter (Skip Prompts)
**Given** a user runs `npx simplicity-admin init my-crm --starter crm`
**When** the command executes
**Then** skips the defaults prompt entirely and scaffolds with the CRM starter. The `--starter` flag signals intent — no confirmation needed.

### B-CLI-001e: Init — Starter Contents
**Given** a starter other than `blank` is selected
**When** scaffolding completes
**Then** creates the standard files (package.json, config, compose.yaml, .env.example, .gitignore, empty `schema/` and `views/` directories) PLUS:
- `schema/tables/` pre-populated with starter-specific simplicity-schema YAML files (e.g., contacts, deals, activities for CRM)
- `simplicity-admin.config.ts` with starter-appropriate nav config and comments

### B-CLI-001f: Init — Unknown Starter
**Given** a user runs `npx simplicity-admin init my-app --starter ecommerce`
**When** the command executes
**Then** shows error: "Unknown starter 'ecommerce'. Available starters: blank, crm, cms, todo"

### B-CLI-001g: Init — Success Message
**Given** scaffolding completes successfully
**When** the output is printed
**Then** shows:
```
Created my-admin/

  cd my-admin
  npx simplicity-admin dev

Config: simplicity-admin.config.ts (edit anytime)
```

### B-CLI-002: Init — Directory Already Exists
**Given** directory `my-admin/` already exists and is non-empty
**When** `npx simplicity-admin init my-admin` is run
**Then** shows error: "Directory 'my-admin' already exists and is not empty"

### B-CLI-003: Init — Current Directory
**Given** user runs `npx simplicity-admin init .` in an empty directory
**When** the command executes
**Then** scaffolds in the current directory (no subdirectory created)

### B-CLI-004: Dev — Full Stack Start
**Given** a valid config file and PostgreSQL is accessible
**When** `npx simplicity-admin dev` is run
**Then** bootstraps the database (simplicity-schema), starts the API server (PostGraphile), and starts the UI server (SvelteKit), displaying URLs in a startup banner

### B-CLI-005: Dev — Startup Banner
**Given** dev server starts on port 3000
**When** startup completes
**Then** prints:
```
  SIMPLICITY-ADMIN dev server running:

  Admin UI:  http://localhost:3000/admin
  GraphQL:   http://localhost:3000/api/graphql
  GraphiQL:  http://localhost:3000/api/graphql (browser)

  Default login: admin@localhost / changeme
```

### B-CLI-006: Dev — Database Not Available
**Given** PostgreSQL is not running or URL is wrong
**When** `npx simplicity-admin dev` is run
**Then** shows clear error: "Cannot connect to database: [details]. Is PostgreSQL running?"

### B-CLI-007: Dev — Config Not Found
**Given** no config file exists in the current directory
**When** `npx simplicity-admin dev` is run
**Then** shows error: "No config file found. Run `npx simplicity-admin init` first or create simplicity-admin.config.ts"

### B-CLI-008: Build — Production Build
**Given** a valid project
**When** `npx simplicity-admin build` is run
**Then** builds the SvelteKit UI for production and compiles TypeScript

### B-CLI-009: Start — Production Server
**Given** a production build exists
**When** `npx simplicity-admin start` is run
**Then** starts the production server (no hot reload, no GraphiQL)

### B-CLI-010: Generate — Schema from DB
**Given** a database with existing tables
**When** `npx simplicity-admin generate` is run
**Then** generates simplicity-schema YAML files in `schema/` representing the current database (delegates to simplicity-schema)

### B-CLI-011: Migrate — Run Migrations
**Given** simplicity-schema YAML files exist with changes
**When** `npx simplicity-admin migrate` is run
**Then** runs simplicity-schema migrations (plan + apply)

### B-CLI-014: Env Export
**Given** admin view overrides and admin strategy configs exist in `_simplicity_admin`
**When** `npx simplicity-admin env export --output prod-config.json` is run
**Then** exports all admin-managed runtime configuration (view overrides, permission overrides, tenant strategy configs) as a portable JSON file. User saved views are NOT included.

### B-CLI-015: Env Import
**Given** a `prod-config.json` file exported from production
**When** `npx simplicity-admin env import --input prod-config.json` is run in a sandbox
**Then** applies the overrides to the sandbox's `_simplicity_admin` tables (upsert by table/key). Warns and skips entries that reference non-existent tables.

### B-CLI-016: Env Export — Default Output
**Given** no `--output` flag is specified
**When** `npx simplicity-admin env export` is run
**Then** writes to `simplicity-admin-env.json` in the current directory

### B-CLI-012: Help
**Given** user runs `npx simplicity-admin --help`
**When** command executes
**Then** displays usage information with all available commands and their descriptions

### B-CLI-013: Version
**Given** user runs `npx simplicity-admin --version`
**When** command executes
**Then** displays the installed version number

### B-CLI-014: Middleware Mode
**Given** developer imports `createAdmin` in their Express app
**When** `app.use('/admin', createAdmin({ database: url }))` is called
**Then** mounts the full admin suite (API + UI) at `/admin`

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Directory not empty (init) | CLIError | CLI_001 | Exit with error message |
| Config file not found | CLIError | CLI_002 | Exit with instructions |
| Database connection failed | CLIError | CLI_003 | Exit with connection error details |
| Build failed | CLIError | CLI_004 | Exit with build error details |
| Unknown command | CLIError | CLI_005 | Exit with "Unknown command" + help suggestion |

## Security Considerations

- `init` must not overwrite existing files without confirmation
- Generated `.env.example` must contain placeholder values, not real credentials
- Production mode must disable GraphiQL and debug features
- `start` must require `auth.secret` to be explicitly set (no auto-generation in production)

## Test Requirements

### Unit Tests
- [ ] `--help` outputs usage text
- [ ] `--version` outputs version number
- [ ] `createAdmin()` returns a valid HttpHandler
- [ ] Unknown command shows error + help

### Integration Tests
- [ ] `init` creates expected file structure (blank starter)
- [ ] `init --starter crm` includes CRM schema files
- [ ] `init --starter unknown` shows error with available starters
- [ ] `init` fails for non-empty directory
- [ ] `dev` starts and responds to health check
- [ ] `dev` bootstraps database on first run
- [ ] `generate` produces YAML files from test database
- [ ] `migrate` applies schema changes
- [ ] `build` produces production output

## File Manifest

```
packages/cli/
  src/
    index.ts                    # Programmatic API (createAdmin, startServer)
    cli.ts                      # CLI entry point (arg parsing)
    commands/
      init.ts                   # Scaffold command
      dev.ts                    # Dev server command
      build.ts                  # Production build command
      start.ts                  # Production server command
      generate.ts               # Schema generation command
      migrate.ts                # Migration command
      env.ts                    # Environment export/import
    templates/                  # Shared scaffold templates
      package.json.tmpl
      config.ts.tmpl
      compose.yaml.tmpl
      env.example.tmpl
      gitignore.tmpl
    starters/                   # Starter-specific schema + config
      blank/                    # Minimal (empty schema dir)
      crm/                      # Contacts, deals, activities, pipelines
        schema/
        config.ts.tmpl
      cms/                      # Pages, posts, media, categories
        schema/
        config.ts.tmpl
      todo/                     # Projects, tasks, labels
        schema/
        config.ts.tmpl
  tests/
    cli.test.ts                 # CLI command tests
    init.test.ts                # Init scaffold tests
    server.test.ts              # Dev/start server tests
  package.json
  tsconfig.json
```

## Decision References

- ADR-001: PostgreSQL — bootstrap and migrate use simplicity-schema
- ADR-002: PostGraphile — dev server starts PostGraphile
- ADR-004: SvelteKit — build/start manage SvelteKit production build
