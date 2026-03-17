---
title: Environment Variables
description: All supported environment variables and their resolution behavior.
---

SIMPLICITY-ADMIN reads the following environment variables. Environment variables override values set in the config file.

## Variables

### `DATABASE_URL`

- **Config equivalent:** `database`
- **Required:** Yes (if not set in config)
- **Description:** PostgreSQL connection string.

```bash
DATABASE_URL=postgres://user:password@localhost:5432/mydb
```

### `SIMPLICITY_ADMIN_DATABASE`

- **Config equivalent:** `database`
- **Required:** No
- **Description:** Alternative to `DATABASE_URL`. If both are set, `SIMPLICITY_ADMIN_DATABASE` takes precedence.

### `SIMPLICITY_ADMIN_PORT`

- **Config equivalent:** `port`
- **Required:** No
- **Default:** `3000`
- **Description:** Server port for standalone mode.

```bash
SIMPLICITY_ADMIN_PORT=4000
```

### `SIMPLICITY_ADMIN_AUTH_SECRET`

- **Config equivalent:** `auth.secret`
- **Required:** Yes (if not set in config)
- **Description:** Secret key for JWT signing and verification. Use a cryptographically random string of at least 32 characters in production.

```bash
SIMPLICITY_ADMIN_AUTH_SECRET=your-secret-key-at-least-32-chars
```

### `NODE_ENV`

- **Config equivalent:** none
- **Required:** No
- **Default:** `'development'`
- **Description:** Standard Node.js environment variable. Affects behavior:

| Value | Effect |
|-------|--------|
| `development` | Verbose logging, GraphiQL enabled, detailed error messages |
| `production` | Minimal logging, GraphiQL respects config, generic error messages |

## Resolution Order

Environment variables sit between the config file and runtime overrides in the resolution chain:

1. **Defaults** — Built-in values
2. **Config file** — `simplicity-admin.config.ts`
3. **Environment variables** — Override config file values
4. **Runtime overrides** — Options passed to `createAdmin()`

For example, if your config file sets `port: 3000` but `SIMPLICITY_ADMIN_PORT=4000` is set in the environment, the server runs on port 4000.

## `.env` File Support

The `init` command generates a `.env` file with placeholder values. SIMPLICITY-ADMIN loads `.env` files automatically in development. In production, set environment variables through your hosting platform's configuration.

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/mydb
SIMPLICITY_ADMIN_AUTH_SECRET=change-me-to-a-random-secret
```
