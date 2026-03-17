# Milestones

## 0 — Infrastructure

- [x] T-000: Infrastructure bootstrap

## M1 — Foundation

- [x] T-001: Initialize monorepo structure
- [x] T-002: Core error classes
- [x] T-003: Core config types + Zod schema
- [x] T-004: Core config loader
- [x] T-005: Core metadata types + column type mapping
- [x] T-006: Core provider interfaces + registry
- [x] T-007: Core plugin types + manager
- [x] T-008: Core index — re-export all public API
- [x] T-009: Initialize @simplicity-admin/db package
- [x] T-010: DB connection manager
- [x] T-011: DB introspection — list tables
- [x] T-012: DB introspection — columns
- [x] T-013: DB introspection — relations
- [x] T-014: DB introspection — enums
- [x] T-015: DB introspection — full schema assembly
- [x] T-016: System schema YAML (simplicity-schema)
- [x] T-017: DB bootstrap orchestrator
- [x] T-018: DB provider (default DatabaseProvider)
- [x] T-019: Initialize @simplicity-admin/auth package
- [x] T-020: Password utilities
- [x] T-021: JWT provider
- [x] T-022: Auth middleware
- [x] T-023: Login/logout/refresh routes
- [x] T-024: Auth index — re-export all public API
- [x] T-025: Initialize @simplicity-admin/api package
- [x] T-026: pgSettings mapper
- [x] T-027: PostGraphile preset
- [x] T-028: API server
- [x] T-029: Initialize @simplicity-admin/ui package
- [x] T-030: Design tokens + theming
- [x] T-031: Field type mapping
- [x] T-032: DataTable component
- [x] T-033: Form field components
- [x] T-034: AutoForm component
- [x] T-035: Layout components (Shell, Sidebar, TopBar)
- [x] T-036: GraphQL query builder
- [x] T-037: Admin app — SvelteKit entry point + auth gate
- [x] T-038: Admin app — dynamic list view
- [x] T-039: Admin app — dynamic create/edit/delete views
- [x] T-040: Initialize @simplicity-admin/cli package
- [x] T-041: CLI init command
- [x] T-042: CLI dev command
- [x] T-043: CLI generate + migrate commands
- [x] T-044: M1 end-to-end smoke test

## M2 — Access Control

- [x] T-045: RBAC permission types
- [x] T-046: RBAC permission engine
- [x] T-047: RBAC UI overrides
- [x] T-048: RBAC integration into CRUD views
- [x] T-049: Navigation builder
- [x] T-050: Role-based navigation integration
- [x] T-051: Permissions management UI
- [x] T-052: M2 end-to-end smoke test

## M3 — Intelligence

- [x] T-053: Dashboard types + storage
- [x] T-054: Widget execution engine
- [x] T-055: Dashboard widget components
- [x] T-056: Dashboard routes + builder UI
- [x] T-057: Notification types + engine
- [x] T-058: Notification delivery (in-app + email)
- [x] T-059: Notification UI
- [x] T-060: M3 end-to-end smoke test

## M4 — Automation

- [x] T-061: Workflow types
- [x] T-062: Workflow guard evaluation
- [x] T-063: Workflow action executors
- [x] T-064: Workflow engine — state machines
- [x] T-065: Workflow engine — event automations
- [x] T-066: Workflow UI — state badges + transition buttons
- [x] T-067: Workflow management UI
- [x] T-068: M4 end-to-end smoke test

## M5 — Security Hardening ($9.22)

- [x] T-069: Bootstrap via simplicity-schema programmatic API — $1.73
- [x] T-070: Server-side RBAC enforcement on mutations — $1.10
- [x] T-071: JWT secret validation and production guard — $0.80
- [x] T-072: SQL identifier escaping utility — $0.68
- [x] T-073: Rate limiting on auth endpoints — $0.49
- [x] T-074: Request body size limiting — $0.24
- [x] T-075: Error message sanitization — $0.35
- [x] T-076: Timing-safe login — $0.35
- [x] T-077: Token revocation persistence — $0.68
- [x] T-078: Refresh token rotation — $0.56
- [x] T-079: Security headers — $0.23
- [x] T-080: GraphQL depth limiting — $0.94
- [x] T-081: begin_session role validation — $0.29
- [x] T-082: M5 security integration test — $0.78

## M6 — Code Quality & Hardening ($9.45)

- [x] T-083: Replace z.any() with typed schemas in core config — $0.63
- [x] T-084: Add justifying comments to all as any casts — $0.19
- [x] T-085: Validate JSON-parsed user input with Zod — $0.82
- [ ] T-086: Extract shared admin auth check helper
- [ ] T-087: Replace unsafe double type casts with runtime validation
- [x] T-088: Test infrastructure — Docker lifecycle and per-test database isolation — $5.42
- [x] T-089: Fix Svelte 5 state_referenced_locally warnings — $0.93
- [x] T-090: Convert test-support to a workspace package — $1.46

**Grand Total: $18.67**
