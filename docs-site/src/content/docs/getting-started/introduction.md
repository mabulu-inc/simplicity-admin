---
title: Introduction
description: What SIMPLICITY-ADMIN is and why it exists.
---

SIMPLICITY-ADMIN is a packaged dependency that gives you a production-grade back-office admin suite by pointing it at a PostgreSQL database. No code generation, no boilerplate — install, configure your connection string, and get a fully functional admin panel with GraphQL API, authentication, and role-based access control.

## Core Value Proposition

Point at a database. Get an admin panel.

SIMPLICITY-ADMIN introspects your PostgreSQL schema and automatically generates:

- **CRUD views** for every table
- **Forms** with correct field types derived from column types
- **Relations** resolved from foreign keys
- **A GraphQL API** powered by PostGraphile V5
- **Authentication and RBAC** out of the box

## Design Principles

### Zero-Config

Works immediately with sensible defaults. A `DATABASE_URL` is the only required configuration. Everything else has a default that covers the common case.

### Schema-as-Truth

Your database schema is the single source of truth. Tables become views, columns become form fields, foreign keys become relations, enums become dropdowns. Change your schema, and the admin panel updates automatically.

### Provider Pattern

Every major subsystem (database, API, auth, UI) is defined by a provider interface. Swap any layer without touching the rest. Use the built-in providers or bring your own.

### Security-First

PostgreSQL Row-Level Security (RLS) is the foundation, not an afterthought. JWT authentication, bcrypt password hashing, and a three-layer RBAC model are included by default.

## Who Is It For?

### Solo Developer

Skip weeks of admin panel development. Point SIMPLICITY-ADMIN at your database and ship your actual product instead.

### Team Lead

Give your team a consistent, well-structured admin tool with proper access controls without dedicating engineering resources to build one.

### Platform Engineer

Embed SIMPLICITY-ADMIN as middleware in your existing Node.js application. Mount it at any path alongside your own routes.

### Business Admin

Use the auto-generated UI to manage data, configure views, and control access — no code required after initial setup.

## Tech Stack

- **Database:** PostgreSQL
- **GraphQL:** PostGraphile V5
- **UI:** SvelteKit
- **Auth:** JWT + bcrypt
- **Schema Management:** simplicity-schema (declarative DDL via YAML)

## Next Steps

Head to the [Quick Start](/getting-started/quick-start/) to get a running admin panel in under five minutes.
