// @simplicity-admin/core — public API
// Re-exports will be added as modules are implemented.

export {
  ConfigError,
  ProviderError,
  PluginError,
  ValidationError,
  HookError,
  ActionError,
} from './errors.js';

export type {
  ProjectConfig,
  APIConfig,
  AuthConfig,
  AuthStrategyConfig,
  TenancyConfig,
  ProviderOverrides,
} from './config/types.js';

export { DEFAULT_CONFIG } from './config/defaults.js';
export { defineConfig } from './config/schema.js';
export { loadConfig, resolveConfig } from './config/loader.js';

export type {
  ColumnType,
  ColumnMeta,
  TableMeta,
  RelationMeta,
  EnumMeta,
  SchemaMeta,
} from './metadata/types.js';

export { mapPgType } from './metadata/column-types.js';

export type {
  Provider,
  DatabaseProvider,
  APIProvider,
  TokenProvider,
  AuthStrategy,
  AuthResult,
  TableHooks,
  HookContext,
  TableAction,
  ActionContext,
  ActionResult,
  UIProvider,
  UIConfig,
  HttpHandler,
  TokenPayload,
  TokenPair,
  ConnectionPool,
  QueryResult,
  PoolClient,
  MigrationConfig,
  MigrationResult,
} from './providers/types.js';

export { ProviderRegistry, createRegistry } from './providers/registry.js';

export type {
  Plugin,
  AppContext,
  RequestContext,
} from './plugins/types.js';

export { PluginManager } from './plugins/manager.js';

// Notification types & engine
export type {
  NotificationChannel,
  TriggerEvent,
  NotificationRule,
  NotificationTemplate,
  RecipientConfig,
  Notification,
  DataEvent,
  EmailProvider,
} from './notifications/types.js';
export { NotificationEngine } from './notifications/engine.js';
export {
  evaluateCondition,
  interpolateTemplate,
  createRule,
  updateRule,
  deleteRule,
  listRules,
} from './notifications/rules.js';

// Email provider
export type { SmtpConfig } from './notifications/email/types.js';
export { SmtpEmailProvider } from './notifications/email/provider.js';

// Workflow types
export type {
  StateMachine,
  StateDefinition,
  Transition,
  TransitionGuard,
  TransitionHook,
  NotificationHookConfig,
  WebhookHookConfig,
  UpdateFieldHookConfig,
  Automation,
  AutomationTrigger,
  AutomationCondition,
  AutomationAction,
  TransitionResult,
  TransitionLogEntry,
  AutomationResult,
} from './workflow/types.js';

export {
  evaluateGuard,
  evaluateCondition as evaluateWorkflowCondition,
  evaluateConditions as evaluateWorkflowConditions,
} from './workflow/guards.js';

export type { ActionExecutorContext, ActionExecutorResult } from './workflow/actions.js';
export { executeHook, executeAction } from './workflow/actions.js';
