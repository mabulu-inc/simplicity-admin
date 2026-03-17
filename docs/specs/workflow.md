# Workflow Module Specification

**PRD Reference:** §5 (US-013, US-014)

## Overview

The workflow module provides two complementary automation capabilities:

1. **State Machines**: Define record lifecycle states and transitions with role-based guards and hooks (e.g., draft -> review -> approved -> published).
2. **Event-Driven Automation**: Trigger actions on data events with conditional logic (e.g., when a deal is marked "won", send an email and create a follow-up task).

Both can be defined code-first (in config) or managed via the admin UI. State machines and automations are tenant-scoped when multi-tenancy is enabled.

## Package Location

- Workflow engine: `packages/core/src/workflow/`
- Workflow UI: `packages/ui/src/routes/(app)/settings/workflow/`
- Tests: `packages/core/tests/workflow/`

## Dependencies

- `@mabulu-inc/simplicity-admin-core` — config types, notification engine (for actions)
- `@mabulu-inc/simplicity-admin-db` — connection pool, data event hooks
- `@mabulu-inc/simplicity-admin-auth` — RBAC (transition guards reference roles)

## Public API

### State Machine Types

```typescript
// packages/core/src/workflow/types.ts

export interface StateMachine {
  id: string;
  table: string;
  column: string;              // Which column holds the state
  states: StateDefinition[];
  transitions: Transition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StateDefinition {
  name: string;
  label: string;
  color?: string;              // Badge color in UI
  isFinal?: boolean;           // No outgoing transitions allowed
}

export interface Transition {
  from: string;                // State name
  to: string;                  // State name
  label: string;               // Button label in UI (e.g., "Approve")
  roles: string[];             // Which roles can perform this transition
  guard?: TransitionGuard;     // Condition that must be true
  hooks?: TransitionHook[];    // Actions triggered on transition
}

export interface TransitionGuard {
  condition: string;           // SQL-like condition on the record (e.g., "value > 1000")
}

export interface TransitionHook {
  type: 'notification' | 'webhook' | 'update_field';
  config: NotificationHookConfig | WebhookHookConfig | UpdateFieldHookConfig;
}

export interface NotificationHookConfig {
  ruleId?: string;             // Reference existing notification rule
  template?: NotificationTemplate;  // Inline template
  recipients: RecipientConfig;
}

export interface WebhookHookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;       // JSON template with {{field}} interpolation
}

export interface UpdateFieldHookConfig {
  field: string;
  value: string;               // Static value or {{field}} interpolation
}
```

### Event Automation Types

```typescript
export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationTrigger {
  event: 'onCreate' | 'onUpdate' | 'onDelete' | 'onFieldChange' | 'onSchedule';
  table?: string;
  field?: string;              // For onFieldChange
  schedule?: string;           // Cron expression for onSchedule
}

export interface AutomationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface AutomationAction {
  type: 'send_email' | 'call_webhook' | 'update_record' | 'create_record';
  config: Record<string, unknown>;  // Type-specific config
}
```

### Workflow Engine

```typescript
// packages/core/src/workflow/engine.ts

export class WorkflowEngine {
  constructor(pool: ConnectionPool, notificationEngine: NotificationEngine);

  /** Register a state machine for a table */
  registerStateMachine(machine: StateMachine): void;

  /** Register an automation */
  registerAutomation(automation: Automation): void;

  /** Attempt a state transition (validates guards and role) */
  transition(
    table: string,
    recordId: string,
    toState: string,
    userId: string,
    role: string,
    comment?: string
  ): Promise<TransitionResult>;

  /** Get available transitions for a record in its current state */
  getAvailableTransitions(
    table: string,
    recordId: string,
    role: string
  ): Promise<Transition[]>;

  /** Process a data event against registered automations */
  processEvent(event: DataEvent): Promise<AutomationResult[]>;

  /** Get state transition history for a record */
  getTransitionHistory(table: string, recordId: string): Promise<TransitionLogEntry[]>;
}

export interface TransitionResult {
  success: boolean;
  fromState: string;
  toState: string;
  error?: string;
  hooksExecuted: { type: string; success: boolean; error?: string }[];
}

export interface TransitionLogEntry {
  id: string;
  fromState: string;
  toState: string;
  userId: string;
  comment?: string;
  timestamp: Date;
}

export interface AutomationResult {
  automationId: string;
  automationName: string;
  triggered: boolean;
  actionsExecuted: { type: string; success: boolean; error?: string }[];
}
```

### State Machine Management

```typescript
// packages/core/src/workflow/management.ts

export function createStateMachine(pool: ConnectionPool, machine: Omit<StateMachine, 'id' | 'createdAt' | 'updatedAt'>): Promise<StateMachine>;
export function updateStateMachine(pool: ConnectionPool, id: string, updates: Partial<StateMachine>): Promise<StateMachine>;
export function deleteStateMachine(pool: ConnectionPool, id: string): Promise<void>;
export function getStateMachine(pool: ConnectionPool, table: string): Promise<StateMachine | null>;
export function listStateMachines(pool: ConnectionPool): Promise<StateMachine[]>;

export function createAutomation(pool: ConnectionPool, automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Automation>;
export function updateAutomation(pool: ConnectionPool, id: string, updates: Partial<Automation>): Promise<Automation>;
export function deleteAutomation(pool: ConnectionPool, id: string): Promise<void>;
export function listAutomations(pool: ConnectionPool): Promise<Automation[]>;
```

## Behavior Specification

### State Machines

### B-WF-001: State Transition — Happy Path
**Given** a deal in state "draft" with a transition "Submit for Review" (draft -> review) allowed for `app_editor`
**When** an `app_editor` calls `transition(deals, dealId, 'review', userId, 'app_editor')`
**Then** the deal's state column is updated to "review" and a transition log entry is created

### B-WF-002: State Transition — Unauthorized Role
**Given** a transition from draft -> review allowed only for `app_editor` and `app_admin`
**When** an `app_viewer` attempts the transition
**Then** returns `{ success: false, error: "Insufficient permissions" }`

### B-WF-003: State Transition — Guard Fails
**Given** a transition with guard `value > 1000` and a deal with value=500
**When** transition is attempted
**Then** returns `{ success: false, error: "Guard condition not met: value > 1000" }`

### B-WF-004: State Transition — Hook Execution
**Given** a transition with a notification hook
**When** transition succeeds
**Then** the notification is sent and `hooksExecuted` includes `{ type: 'notification', success: true }`

### B-WF-005: State Transition — Hook Failure Non-Blocking
**Given** a transition with a webhook hook and the webhook endpoint is down
**When** transition succeeds
**Then** the state change persists, `hooksExecuted` includes `{ type: 'webhook', success: false, error: '...' }`

### B-WF-006: Available Transitions
**Given** a deal in state "review" with transitions: review->approved (app_admin), review->draft (app_editor, app_admin)
**When** an `app_editor` calls `getAvailableTransitions()`
**Then** returns only `[review->draft]` (not review->approved)

### B-WF-007: Final State
**Given** a state "archived" marked as `isFinal: true`
**When** `getAvailableTransitions()` is called for a record in "archived" state
**Then** returns empty array

### B-WF-008: Transition History
**Given** a deal that went draft -> review -> approved
**When** `getTransitionHistory(deals, dealId)` is called
**Then** returns 2 entries in chronological order with from/to states, userId, and timestamps

### Event Automations

### B-WF-009: Automation — onCreate
**Given** an automation: trigger=onCreate, table=deals, action=send_email
**When** a new deal is created
**Then** the automation fires and sends an email

### B-WF-010: Automation — Condition Match
**Given** an automation with condition `stage eq 'won'`
**When** a deal is updated with stage='won'
**Then** the automation fires

### B-WF-011: Automation — Condition No Match
**Given** an automation with condition `stage eq 'won'`
**When** a deal is updated with stage='negotiation'
**Then** the automation does NOT fire

### B-WF-012: Automation — Webhook Action
**Given** an automation with action type=call_webhook
**When** the automation fires
**Then** an HTTP POST is sent to the configured URL with the record data

### B-WF-013: Automation — Update Record Action
**Given** an automation with action: update_record, field=priority, value='high'
**When** the automation fires
**Then** the record's priority field is updated to 'high'

### B-WF-014: Automation — Create Record Action
**Given** an automation with action: create_record (create a follow-up activity)
**When** the automation fires
**Then** a new record is created in the specified table

### B-WF-015: Automation — Disabled
**Given** an automation with `enabled: false`
**When** a matching event occurs
**Then** the automation does NOT fire

### B-WF-016: Automation — Execution Log
**Given** an automation fires
**When** execution completes
**Then** an execution log entry is created with automation ID, status, duration, and any errors

### B-WF-017: UI — State Badge
**Given** a record with a state machine and current state "review" (color: yellow)
**When** the record detail page renders
**Then** a colored badge shows "Review" with available transition buttons

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Invalid state transition | WorkflowError | WF_001 | Return error result (no state change) |
| Guard evaluation error | WorkflowError | WF_002 | Return error result with guard details |
| Hook execution failure | — | — | Log error, continue (non-blocking) |
| No state machine for table | WorkflowError | WF_003 | Return null / empty transitions |
| Webhook timeout | — | — | Log error in execution log, mark action as failed |
| Automation loop detected | WorkflowError | WF_004 | Stop execution, log error (max 10 chained automations) |

## Security Considerations

- State transitions are role-guarded — only authorized roles can perform transitions
- Guard conditions must be evaluated safely (parameterized, no raw SQL execution)
- Webhook URLs must be validated (no internal/private IP addresses to prevent SSRF)
- Automation loop detection prevents infinite chains (max depth: 10)
- State machine definitions can only be created/edited by `app_admin`

## Test Requirements

### Unit Tests
- [ ] State machine validates transition exists
- [ ] State machine rejects unauthorized role
- [ ] Guard condition evaluation (true/false cases)
- [ ] Available transitions filtered by role
- [ ] Final state returns no transitions
- [ ] Automation condition evaluation for all operators
- [ ] Disabled automations are skipped
- [ ] Loop detection stops at depth 10

### Integration Tests
- [ ] `transition()` updates record state in database
- [ ] `transition()` creates audit log entry
- [ ] `transition()` executes notification hooks
- [ ] `getTransitionHistory()` returns chronological log
- [ ] `processEvent()` fires matching automations
- [ ] `processEvent()` skips non-matching conditions
- [ ] Webhook action sends HTTP request
- [ ] Update record action modifies database
- [ ] Create record action inserts new record
- [ ] Execution log records automation runs

## File Manifest

```
packages/core/
  src/
    workflow/
      types.ts                  # StateMachine, Transition, Automation types
      engine.ts                 # WorkflowEngine class
      management.ts             # CRUD for state machines and automations
      guards.ts                 # Guard condition evaluation
      actions.ts                # Action executors (webhook, email, update, create)
  tests/
    workflow/
      engine.test.ts            # State machine + automation tests
      guards.test.ts            # Guard evaluation tests
      actions.test.ts           # Action executor tests

packages/ui/
  src/
    lib/
      components/
        workflow/
          StateBadge.svelte
          TransitionButtons.svelte
    routes/
      (app)/
        settings/
          workflow/
            +page.svelte        # State machine management
            +page.server.ts
          automations/
            +page.svelte        # Automation management
            +page.server.ts
```

## Decision References

- ADR-005: RBAC — transitions are role-guarded
- ADR-006: Provider pattern — webhook/email actions use provider interfaces
