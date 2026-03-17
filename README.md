# SIMPLICITY-ADMIN

A packaged dependency that gives any developer a fully functional, production-grade back-office admin suite by pointing it at a database.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

## Quick Start

```bash
pnpm create @mabulu-inc/simplicity-admin my-admin
cd my-admin
# Edit simplicity-admin.config.ts with your DATABASE_URL
npm run dev
```

That's it. You have a working admin panel with authentication, auto-generated CRUD, and a GraphQL API.

## Features

- **Zero-config to start** — provide a database URL and get a working admin panel in under 5 minutes
- **Schema-as-truth** — tables become CRUD views, columns become form fields, foreign keys become relations, enums become dropdowns
- **Role-based access control (RBAC)** — column-level grants, row-level security, and functional roles enforced at the database level
- **Multi-tenancy** — row-level tenant isolation via RLS, invisible when not configured
- **State machines** — define workflow lifecycles per table with role-gated transitions and audit trails
- **Notifications** — configurable rules for in-app and email alerts on data events
- **Dashboards** — build custom dashboards with stat cards, tables, and charts
- **Provider pattern** — every default (PostgreSQL, PostGraphile, JWT, SvelteKit) is swappable via TypeScript interfaces

## Packages

| Package | Description |
|---------|-------------|
| `@mabulu-inc/simplicity-admin-core` | Config system, metadata model, provider interfaces, plugin registry |
| `@mabulu-inc/simplicity-admin-db` | Database connection, schema introspection, bootstrap via simplicity-schema |
| `@mabulu-inc/simplicity-admin-auth` | JWT authentication, bcrypt password hashing, RBAC engine |
| `@mabulu-inc/simplicity-admin-api` | PostGraphile V5 GraphQL API, optional REST adapter |
| `@mabulu-inc/simplicity-admin-ui` | SvelteKit admin UI with auto-generated views and components |
| `@mabulu-inc/simplicity-admin-cli` | CLI commands: init, dev, build, generate |

## Documentation

Full documentation is available at [mabulu-inc.github.io/simplicity-admin](https://mabulu-inc.github.io/simplicity-admin).

## Development

```bash
git clone https://github.com/mabulu-inc/simplicity-admin.git
cd simplicity-admin
pnpm install
pnpm check
```

Requires Node.js >= 20 and pnpm 9+. A PostgreSQL instance is needed for integration tests — use the included `compose.yaml`:

```bash
docker compose up -d
```

## License

SIMPLICITY-ADMIN is licensed under the [Business Source License 1.1 (BSL 1.1)](LICENSE).

- **Free for**: non-production use, internal tools, evaluation, development, testing
- **Paid license required for**: production commercial use serving external users
- **Change date**: 4 years from each release, after which the code converts to Apache 2.0

See the [LICENSE](LICENSE) file for full terms.
