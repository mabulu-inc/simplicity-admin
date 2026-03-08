import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConfigError } from '../errors.js';
import { defineConfig } from './schema.js';
import type { ProjectConfig } from './types.js';

/** Default config file names searched when no explicit path is given. */
const DEFAULT_CONFIG_FILES = [
  'simplicity-admin.config.ts',
  'simplicity-admin.config.js',
  'simplicity-admin.config.mjs',
];

/** Known env var → config field mappings. */
const ENV_MAP: Record<string, (val: string, cfg: Partial<ProjectConfig>) => void> = {
  SIMPLICITY_ADMIN_DATABASE: (val, cfg) => { cfg.database = val; },
  SIMPLICITY_ADMIN_SCHEMA: (val, cfg) => { cfg.schema = val; },
  SIMPLICITY_ADMIN_SYSTEM_SCHEMA: (val, cfg) => { cfg.systemSchema = val; },
  SIMPLICITY_ADMIN_PORT: (val, cfg) => { cfg.port = Number(val); },
  SIMPLICITY_ADMIN_BASE_PATH: (val, cfg) => { cfg.basePath = val; },
  SIMPLICITY_ADMIN_AUTH_SECRET: (val, cfg) => {
    cfg.auth = { ...cfg.auth, secret: val };
  },
};

/**
 * Merges file config with environment variable overrides, then validates.
 * Resolution order: defaults < fileConfig < envOverrides.
 */
export function resolveConfig(
  fileConfig: Partial<ProjectConfig>,
  envOverrides: Record<string, string>,
): ProjectConfig {
  const merged: Partial<ProjectConfig> = { ...fileConfig };

  for (const [key, apply] of Object.entries(ENV_MAP)) {
    const val = envOverrides[key];
    if (val !== undefined) {
      apply(val, merged);
    }
  }

  return defineConfig(merged);
}

/**
 * Loads config from a TypeScript/JS file and merges with env vars.
 * If no path is given, searches the current directory for default config file names.
 * Throws ConfigError (CORE_003) if the file is not found.
 *
 * Security: never logs the full config object (may contain secrets).
 */
export async function loadConfig(path?: string): Promise<ProjectConfig> {
  const configPath = path ? resolve(path) : findConfigFile();

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found: ${configPath}`,
      'CORE_003',
    );
  }

  const fileUrl = pathToFileURL(configPath).href;
  const mod = await import(fileUrl);
  const fileConfig: Partial<ProjectConfig> = mod.default ?? mod;

  // Collect env overrides from process.env
  const envOverrides: Record<string, string> = {};
  for (const key of Object.keys(ENV_MAP)) {
    if (process.env[key] !== undefined) {
      envOverrides[key] = process.env[key]!;
    }
  }

  return resolveConfig(fileConfig, envOverrides);
}

/** Searches the current working directory for a default config file. */
function findConfigFile(): string {
  const cwd = process.cwd();
  for (const name of DEFAULT_CONFIG_FILES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // No file found — return the first default name so the error message is helpful
  return join(cwd, DEFAULT_CONFIG_FILES[0]);
}
