// packages/core/src/workflow/types.ts — Workflow type definitions

import type { NotificationTemplate, RecipientConfig } from '../notifications/types.js';

// ── State Machine Types ──────────────────────────────────────────────

export interface StateMachine {
  id: string;
  table: string;
  column: string;
  states: StateDefinition[];
  transitions: Transition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StateDefinition {
  name: string;
  label: string;
  color?: string;
  isFinal?: boolean;
}

export interface Transition {
  from: string;
  to: string;
  label: string;
  roles: string[];
  guard?: TransitionGuard;
  hooks?: TransitionHook[];
}

export interface TransitionGuard {
  condition: string;
}

export interface TransitionHook {
  type: 'notification' | 'webhook' | 'update_field';
  config: NotificationHookConfig | WebhookHookConfig | UpdateFieldHookConfig;
}

export interface NotificationHookConfig {
  ruleId?: string;
  template?: NotificationTemplate;
  recipients: RecipientConfig;
}

export interface WebhookHookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

export interface UpdateFieldHookConfig {
  field: string;
  value: string;
}

// ── Event Automation Types ───────────────────────────────────────────

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
  field?: string;
  schedule?: string;
}

export interface AutomationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface AutomationAction {
  type: 'send_email' | 'call_webhook' | 'update_record' | 'create_record';
  config: Record<string, unknown>;
}

// ── Engine Result Types ──────────────────────────────────────────────

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
