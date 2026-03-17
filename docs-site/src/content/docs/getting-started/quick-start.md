---
title: Quick Start
description: Get a running admin panel in under five minutes.
---

## Prerequisites

- Node.js 18+
- A running PostgreSQL database

## Scaffold a New Project

```bash
npx simplicity-admin init my-admin
cd my-admin
```

Set your database connection string:

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/mydb
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000/admin` in your browser. SIMPLICITY-ADMIN introspects your database and generates an admin panel with CRUD views for every table.

## Three Consumption Modes

### 1. CLI Scaffold (Standalone Project)

The quickest path. The `init` command creates a full project with configuration, scripts, and starter files.

```bash
npx simplicity-admin init my-admin
cd my-admin
npm run dev
```

### 2. npm Install (Existing Project)

Add SIMPLICITY-ADMIN to an existing Node.js project as a dependency.

```bash
npm install @mabulu-inc/simplicity-admin-core @mabulu-inc/simplicity-admin-db @mabulu-inc/simplicity-admin-api @mabulu-inc/simplicity-admin-auth @mabulu-inc/simplicity-admin-ui
```

Create a `simplicity-admin.config.ts` at your project root:

```ts
import { defineConfig } from '@mabulu-inc/simplicity-admin-core';

export default defineConfig({
  database: process.env.DATABASE_URL,
});
```

### 3. Embeddable Middleware

Mount SIMPLICITY-ADMIN inside an existing Express (or any Node.js HTTP framework) application.

```ts
import express from 'express';
import { createAdmin } from '@mabulu-inc/simplicity-admin-core';

const app = express();

app.use('/admin', createAdmin({
  database: process.env.DATABASE_URL,
}));

app.get('/', (req, res) => {
  res.send('Your app lives here');
});

app.listen(3000);
```

The admin panel is now available at `/admin` alongside your existing routes.

## What Happens on Startup

1. SIMPLICITY-ADMIN connects to your PostgreSQL database
2. Introspects the schema (tables, columns, foreign keys, enums)
3. Creates a system schema (`_simplicity_admin`) for internal state
4. Generates a GraphQL API via PostGraphile V5
5. Serves the SvelteKit admin UI

## Next Steps

- [Configuration](/getting-started/configuration/) — Customize behavior via `simplicity-admin.config.ts`
- [Architecture](/core-concepts/architecture/) — Understand the provider pattern and package structure
