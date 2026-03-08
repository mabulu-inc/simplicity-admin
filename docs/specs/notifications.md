# Notifications Module Specification

## Overview

The notifications module provides event-driven notifications through multiple channels. Admins can configure notification rules via the admin UI — defining triggers (data events), conditions, templates, and delivery channels. The system supports in-app notifications (notification bell) and email (with swappable SMTP provider).

## Package Location

- Notification engine: `packages/core/src/notifications/` (core types + engine)
- Email provider: `packages/auth/src/notifications/` (shares auth package for user context)
- UI components: `packages/ui/src/lib/components/notifications/`
- Tests: distributed across packages

## Dependencies

- `@simplicity-admin/core` — event system, config types
- `@simplicity-admin/db` — connection pool (notification storage, rule storage)
- `nodemailer` — SMTP email delivery (default email provider)

## Public API

### Notification Types

```typescript
// packages/core/src/notifications/types.ts

export type NotificationChannel = 'in_app' | 'email';
export type TriggerEvent = 'record.created' | 'record.updated' | 'record.deleted' | 'field.changed' | 'schedule';

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerEvent;
  table?: string;                    // Which table triggers this (for record events)
  field?: string;                    // Which field (for field.changed)
  condition?: string;                // SQL-like condition: "status = 'urgent'"
  channels: NotificationChannel[];
  template: NotificationTemplate;
  recipients: RecipientConfig;
  schedule?: string;                 // Cron expression (for schedule trigger)
  createdBy: string;
  createdAt: Date;
}

export interface NotificationTemplate {
  subject: string;                   // Supports {{field}} interpolation
  body: string;                      // Supports {{field}} interpolation
}

export interface RecipientConfig {
  type: 'roles' | 'users' | 'field';
  roles?: string[];                  // Send to all users with these roles
  userIds?: string[];                // Send to specific users
  field?: string;                    // Send to user referenced by this FK field
}

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  read: boolean;
  ruleId: string;
  recordId?: string;
  tableName?: string;
  createdAt: Date;
}
```

### Notification Engine

```typescript
// packages/core/src/notifications/engine.ts

export class NotificationEngine {
  constructor(pool: ConnectionPool, emailProvider?: EmailProvider);

  /** Process a data event against all rules */
  processEvent(event: DataEvent): Promise<void>;

  /** Send a notification to specific users */
  send(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;

  /** Get unread notifications for a user */
  getUnread(userId: string): Promise<Notification[]>;

  /** Mark notification as read */
  markRead(notificationId: string): Promise<void>;

  /** Mark all as read for a user */
  markAllRead(userId: string): Promise<void>;
}

export interface DataEvent {
  type: TriggerEvent;
  table: string;
  recordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId: string;
  tenantId?: string;
}

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}
```

### Notification Rule Management

```typescript
// packages/core/src/notifications/rules.ts

export function createRule(pool: ConnectionPool, rule: Omit<NotificationRule, 'id' | 'createdAt'>): Promise<NotificationRule>;
export function updateRule(pool: ConnectionPool, id: string, updates: Partial<NotificationRule>): Promise<NotificationRule>;
export function deleteRule(pool: ConnectionPool, id: string): Promise<void>;
export function listRules(pool: ConnectionPool): Promise<NotificationRule[]>;
export function evaluateCondition(condition: string, record: Record<string, unknown>): boolean;
```

## Behavior Specification

### B-NOTIF-001: In-App Notification on Record Create
**Given** a rule: trigger=record.created, table=contacts, channel=in_app, recipients=roles:['app_admin']
**When** a new contact is created
**Then** all users with `app_admin` role receive an in-app notification

### B-NOTIF-002: Template Interpolation
**Given** template subject "New contact: {{first_name}} {{last_name}}"
**When** a contact is created with first_name="Alice", last_name="Smith"
**Then** notification subject is "New contact: Alice Smith"

### B-NOTIF-003: Condition Evaluation
**Given** a rule with condition "status = 'urgent'"
**When** a record is created with status='normal'
**Then** no notification is sent

### B-NOTIF-004: Condition Match
**Given** a rule with condition "status = 'urgent'"
**When** a record is created with status='urgent'
**Then** notification IS sent

### B-NOTIF-005: Field Change Trigger
**Given** a rule: trigger=field.changed, field=status
**When** a record is updated and status changes from 'draft' to 'published'
**Then** notification is sent

### B-NOTIF-006: Field Change — No Change
**Given** a rule: trigger=field.changed, field=status
**When** a record is updated but status does NOT change
**Then** no notification is sent

### B-NOTIF-007: Email Notification
**Given** a rule with channel=email
**When** the rule triggers
**Then** an email is sent via the configured EmailProvider to the recipients

### B-NOTIF-008: Notification Bell — Unread Count
**Given** a user has 3 unread notifications
**When** the TopBar renders
**Then** the notification bell shows a badge with "3"

### B-NOTIF-009: Mark as Read
**Given** a user views a notification
**When** `markRead(notificationId)` is called
**Then** the notification is marked as read and the unread count decreases

### B-NOTIF-010: Disabled Rule
**Given** a rule with `enabled: false`
**When** a matching event occurs
**Then** no notification is sent

### B-NOTIF-011: Tenant-Scoped Notifications
**Given** tenancy is enabled
**When** a notification is created
**Then** it is scoped to the current tenant (only visible to users in that tenant)

## Error Handling

| Error Condition | Error Class | Code | Behavior |
|----------------|-------------|------|----------|
| Email delivery failed | NotificationError | NOTIF_001 | Log error, retry up to 3 times, mark as failed |
| Invalid condition syntax | NotificationError | NOTIF_002 | Throw with rule ID and condition string |
| Template variable not found | — | — | Replace with empty string, log warning |
| Rule references non-existent table | NotificationError | NOTIF_003 | Disable rule, log warning |

## Security Considerations

- Notification rules should only be created/edited by `app_admin` role
- Template interpolation must sanitize against XSS (especially for email body)
- Email provider credentials (SMTP password) must never be logged
- In-app notifications must be user-scoped (one user cannot see another's notifications)

## Test Requirements

### Unit Tests
- [ ] `evaluateCondition()` evaluates simple equality
- [ ] `evaluateCondition()` evaluates inequality, gt, lt
- [ ] Template interpolation replaces variables
- [ ] Template interpolation handles missing variables (empty string)
- [ ] Disabled rules are skipped

### Integration Tests
- [ ] `createRule()` persists rule
- [ ] `processEvent()` creates in-app notification for matching rule
- [ ] `processEvent()` skips non-matching conditions
- [ ] `processEvent()` handles field.changed trigger
- [ ] `getUnread()` returns correct notifications for user
- [ ] `markRead()` updates read status
- [ ] `markAllRead()` marks all notifications as read
- [ ] Email provider sends email on notification
- [ ] Tenant-scoped notifications are isolated

## File Manifest

```
packages/core/
  src/
    notifications/
      types.ts                  # Notification, Rule, Template types
      engine.ts                 # NotificationEngine class
      rules.ts                  # Rule CRUD + condition evaluation
      email/
        provider.ts             # Default SMTP EmailProvider
        types.ts                # EmailProvider interface

packages/ui/
  src/
    lib/
      components/
        notifications/
          NotificationBell.svelte
          NotificationList.svelte
          NotificationRuleForm.svelte
    routes/
      (app)/
        notifications/
          +page.svelte          # Notification list page
          +page.server.ts
        settings/
          notifications/
            +page.svelte        # Notification rule management
            +page.server.ts
```

## Decision References

- ADR-006: Provider pattern — EmailProvider is swappable
- ADR-001: PostgreSQL — notification storage and rule evaluation
