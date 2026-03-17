---
title: CLI Commands Reference
description: Complete reference for all simplicity-admin CLI commands.
---

All commands are available via `npx simplicity-admin` or globally if `@mabulu-inc/simplicity-admin-cli` is installed.

## `init`

Scaffold a new SIMPLICITY-ADMIN project.

```bash
npx simplicity-admin init [name]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `name` | Project directory name. Created in the current working directory. |

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--template` | `blank` | Starter template: `blank`, `crm`, `cms`, `todo` |

### Examples

```bash
npx simplicity-admin init my-admin
npx simplicity-admin init my-crm --template crm
```

### Output

Creates a directory with:

- `simplicity-admin.config.ts`
- `package.json`
- `.env` (template with placeholder values)
- `schema/` directory (populated if using a template other than `blank`)

---

## `dev`

Start the development server with hot reloading.

```bash
npx simplicity-admin dev
```

The dev server watches for changes to:

- `simplicity-admin.config.ts`
- `views/*.view.yaml`
- `schema/**/*.yaml`

Schema file changes trigger automatic re-introspection. The server runs on the port specified in config (default: 3000).

---

## `build`

Create a production-optimized build.

```bash
npx simplicity-admin build
```

Outputs compiled assets to the `build/` directory. The build includes the SvelteKit UI, API server configuration, and all provider code. Ready for deployment to any Node.js hosting environment.

---

## `generate`

Introspect the database and generate simplicity-schema YAML files.

```bash
npx simplicity-admin generate
```

Connects to the database specified in your config or `DATABASE_URL` environment variable. Reads the current schema and writes YAML files to `schema/tables/`.

This is useful when adopting SIMPLICITY-ADMIN on an existing database. Run `generate` once to create initial table definitions, then manage all future schema changes through YAML.

### Output

```
schema/tables/users.yaml
schema/tables/products.yaml
schema/tables/categories.yaml
...
```

Each file contains the table definition with columns, types, constraints, foreign keys, and enum references.
