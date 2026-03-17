---
title: "@simplicity-admin/cli"
description: CLI tool for scaffolding, development, building, and schema generation.
---

The `cli` package provides the `simplicity-admin` command-line tool for project scaffolding, development, production builds, and database-to-YAML schema generation.

**Dependencies:** All other `@simplicity-admin` packages.

## Commands

### `init`

Scaffold a new SIMPLICITY-ADMIN project.

```bash
npx simplicity-admin init my-admin
```

This creates a project directory with:

- `simplicity-admin.config.ts` — Configuration file
- `package.json` — Dependencies and scripts
- `.env` — Environment variable template
- `schema/` — Directory for simplicity-schema YAML files

#### Starter Templates

Choose a template with the `--template` flag:

```bash
npx simplicity-admin init my-admin --template crm
```

| Template | Description |
|----------|-------------|
| `blank` | Empty project, no tables (default) |
| `crm` | Contacts, companies, deals, activities |
| `cms` | Pages, posts, categories, media |
| `todo` | Tasks, lists, labels |

### `dev`

Start a development server with hot reloading.

```bash
npx simplicity-admin dev
```

The dev server watches for changes to the config file, view YAML files, and simplicity-schema files. Schema changes trigger re-introspection automatically.

### `build`

Create a production build.

```bash
npx simplicity-admin build
```

Outputs optimized assets ready for deployment. The build includes the SvelteKit UI, API server, and all configured providers.

### `generate`

Introspect the database and generate simplicity-schema YAML files.

```bash
npx simplicity-admin generate
```

This connects to the configured database, reads the current schema, and outputs YAML files to `schema/tables/`. Useful for adopting SIMPLICITY-ADMIN on an existing database — run `generate` once to create the initial YAML definitions, then manage schema changes through YAML going forward.

## Usage with npx

All commands work via `npx` without global installation:

```bash
npx simplicity-admin init my-project
npx simplicity-admin dev
npx simplicity-admin build
npx simplicity-admin generate
```

Or install globally:

```bash
npm install -g @simplicity-admin/cli
simplicity-admin dev
```

See the [CLI Commands reference](/reference/cli-commands/) for full option details.
