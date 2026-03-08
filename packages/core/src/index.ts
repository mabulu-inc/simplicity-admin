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
