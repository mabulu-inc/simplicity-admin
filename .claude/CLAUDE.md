# SIMPLICITY-ADMIN — Claude Code Instructions

## Ralph Loop Boot Sequence

**On every iteration, do this FIRST:**

1. Read `docs/PROGRESS.md` — check "Current State" for last task, next task, blockers
2. Read `docs/TASKS.md` — find the next eligible task (lowest-numbered TODO with all deps DONE)
3. Read the task's referenced spec file (`docs/specs/*.md`) for exact interfaces and behaviors
4. Execute the task using red/green TDD:
   a. Write failing tests (red)
   b. Implement until tests pass (green)
   c. Run full test suite: `pnpm test`
   d. If all pass: commit, update PROGRESS.md, set task to DONE
   e. If blocked: update PROGRESS.md with blocker, move to next eligible task

## Turn Efficiency Rules (MANDATORY)

These rules prevent wasting turns in the stateless Ralph Loop:

- **Do NOT use TodoWrite** — it wastes turns and provides no value in a stateless loop where context is discarded between iterations
- **Do NOT explore library internals** (node_modules, package source code) unless a specific error message requires it
- **Do NOT push to origin** — ralph.sh handles pushing after each iteration
- **Prioritize finishing**: implement → test → fix → commit → update docs. Never explore without a clear purpose.
- **If tests pass, commit immediately.** Do not do extra exploration, refactoring, or cleanup beyond what the task requires.
- **Keep reviews brief**: The architectural/design/security reviews (Task Completion Criteria steps 4-6) should be a quick mental check documented in 1-2 sentences, not a deep multi-file exploration.

## Task Selection Algorithm

1. Read PROGRESS.md "Current State" → "Next eligible task"
2. In TASKS.md, verify that task's `Depends` are all DONE in PROGRESS.md
3. If verified, start that task
4. If not (stale), re-scan TASKS.md: filter TODO, exclude tasks with unmet Depends, pick lowest-numbered

## Task Completion Criteria

A task is DONE only when ALL six conditions hold:
1. All files listed in task's "Produces" field exist
2. All tests listed in task's "Tests" field pass
3. `pnpm check` passes in the affected package(s) — this runs lint, typecheck, test, and build. Zero regressions tolerated.
4. **Architectural review**: Verify the implementation aligns with ARCHITECTURE.md, respects module boundaries, follows the provider pattern, and does not introduce circular dependencies
5. **Design & QA review**: Verify the implementation matches the spec's behavior specifications (B-XXX-NNN), handles all specified error cases, respects RBAC/tenancy/view-layer conventions, produces no regressions in related modules, and all new/modified tests are properly isolated (unique schema/data per test, no shared mutable state)
6. **Security review**: Check new/modified code for OWASP top 10 vulnerabilities (SQL injection, XSS, command injection, etc.), secret leakage, unsafe deserialization, missing input validation at system boundaries, and overly permissive access controls. Verify that user input is never interpolated into SQL/HTML/shell commands without proper escaping or parameterization.

The review should be documented in PROGRESS.md under the task entry with a brief summary of what was checked and any issues found/resolved before marking DONE.

## Commit Convention

- One commit per completed task
- Message format: `T-NNN: short description`
- No Claude attribution in commit messages

## Project Conventions

- **Language**: TypeScript (strict mode, no `any` without justifying comment)
- **File naming**: kebab-case (`my-feature.ts`, `my-component.svelte`)
- **Test files**: `*.test.ts` colocated in `tests/` directories
- **Package imports**: `@simplicity-admin/core`, `@simplicity-admin/db`, `@simplicity-admin/auth`, `@simplicity-admin/api`, `@simplicity-admin/ui`, `@simplicity-admin/cli`
- **Package manager**: pnpm with workspaces
- **Build**: Turbo for task orchestration
- **Testing framework**: Vitest
- **E2E testing**: Playwright

## Testing Policy

- **NEVER mock PostgreSQL or GraphQL** — always use real instances
- **Test isolation is mandatory** — every test must create its own unique schema/data (e.g. a uniquely-named Postgres schema per test or describe block) and clean up after itself. Tests must never depend on or be affected by shared database state. This prevents cross-test pollution and Turbo-cache-masked regressions.
- Unit tests: pure functions, type mappings, config validation
- Integration tests: require real Postgres (Docker Compose provides it)
- E2E tests: Playwright against full running stack
- Test database: provided by `compose.yaml` (see ARCHITECTURE.md)

## Key Architectural Rules

- Every module has a provider interface defined in `@simplicity-admin/core`
- Default implementations live in their own packages
- Providers are registered via config, not dependency injection containers
- Multi-tenancy is always present but invisible when not configured
- Super-admins (`super_admin: true` on user record) bypass tenant membership and can enter global mode for cross-tenant access
- Users may hold multiple roles; the active role is switchable at runtime and drives all RBAC/UI behavior
- RBAC permissions are defined code-first (schema-flow YAML), UI can further restrict but never exceed code-defined ceiling
- RBAC must be enforced server-side on every mutation (create/update/delete), not just in UI rendering — see `docs/specs/security.md` B-SEC-002
- PostGraphile V5 is the default GraphQL provider (swappable)
- schema-flow handles all DDL and migration

## Documentation Map

- `docs/PRD.md` — Vision, requirements, user stories (US-NNN), acceptance criteria (AC-NNNx)
- `docs/ARCHITECTURE.md` — System design, module boundaries, data flow
- `docs/specs/*.md` — Per-module specifications with exact TypeScript interfaces (including `views.md` for the view layer, `security.md` for hardening)
- `docs/decisions/*.md` — Architecture Decision Records (ADRs)
- `docs/TASKS.md` — Ordered task list with dependencies
- `docs/PROGRESS.md` — Append-only progress log (read this first every iteration)

## Package Structure

```
packages/
  core/       # Config, types, plugin registry, lifecycle hooks
  db/         # DB introspection, schema-flow integration, bootstrap
  api/        # PostGraphile preset, REST adapter, API server
  auth/       # JWT provider, middleware, routes
  ui/         # SvelteKit admin UI, components, theming
  cli/        # CLI tool (init, dev, build) — includes starter templates
```
