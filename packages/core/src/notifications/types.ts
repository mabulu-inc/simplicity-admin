// packages/core/src/notifications/types.ts — Notification types

export type NotificationChannel = 'in_app' | 'email';
export type TriggerEvent = 'record.created' | 'record.updated' | 'record.deleted' | 'field.changed' | 'schedule';

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerEvent;
  table?: string;
  field?: string;
  condition?: string;
  channels: NotificationChannel[];
  template: NotificationTemplate;
  recipients: RecipientConfig;
  schedule?: string;
  createdBy: string;
  createdAt: Date;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
}

export interface RecipientConfig {
  type: 'roles' | 'users' | 'field';
  roles?: string[];
  userIds?: string[];
  field?: string;
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
