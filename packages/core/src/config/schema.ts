import { z } from 'zod';
import { ConfigError } from '../errors.js';
import { DEFAULT_CONFIG, DEFAULT_API, DEFAULT_AUTH, DEFAULT_TENANCY } from './defaults.js';
import type { ProjectConfig } from './types.js';

const authStrategySchema = z.object({
  type: z.string(),
  enabled: z.boolean().optional(),
  provider: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  callbackUrl: z.string().optional(),
  otpProvider: z.string().optional(),
  tenantConfigurable: z.boolean().optional(),
  strategy: z.any().optional(),
});

const apiSchema = z.object({
  graphql: z.union([z.string(), z.literal(false)]).optional(),
  rest: z.union([z.string(), z.literal(false)]).optional(),
  graphiql: z.boolean().optional(),
});

const authSchema = z.object({
  secret: z.string().min(32).optional(),
  accessTokenTTL: z.number().optional(),
  refreshTokenTTL: z.number().optional(),
  strategies: z.array(authStrategySchema).optional(),
});

const tenancySchema = z.object({
  enabled: z.boolean().optional(),
  resolution: z.enum(['header', 'subdomain', 'path']).optional(),
  header: z.string().optional(),
});

const projectConfigSchema = z.object({
  database: z.string({ error: 'database is required' }),
  schema: z.string().optional(),
  systemSchema: z.string().optional(),
  port: z.number().optional(),
  basePath: z.string().optional(),
  api: apiSchema.optional(),
  auth: authSchema.optional(),
  tenancy: tenancySchema.optional(),
  hooks: z.record(z.string(), z.any()).optional(),
  actions: z.record(z.string(), z.any()).optional(),
  providers: z.any().optional(),
  plugins: z.array(z.any()).optional(),
});

/**
 * Validates and applies defaults to a partial config object.
 * Throws ConfigError on validation failure.
 */
export function defineConfig(input: Partial<ProjectConfig>): ProjectConfig {
  const result = projectConfigSchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    // Missing required field
    if (issue.code === 'invalid_type' && issue.message.includes('is required')) {
      throw new ConfigError(
        `${field} is required`,
        'CORE_001',
      );
    }
    // Type mismatch (e.g. port: "string" instead of number)
    throw new ConfigError(
      `Invalid config: ${field} — ${issue.message}`,
      'CORE_002',
    );
  }

  const validated = result.data;

  return {
    ...validated,
    schema: validated.schema ?? DEFAULT_CONFIG.schema,
    systemSchema: validated.systemSchema ?? DEFAULT_CONFIG.systemSchema,
    port: validated.port ?? DEFAULT_CONFIG.port,
    basePath: validated.basePath ?? DEFAULT_CONFIG.basePath,
    api: {
      graphql: validated.api?.graphql ?? DEFAULT_API.graphql,
      rest: validated.api?.rest ?? DEFAULT_API.rest,
      graphiql: validated.api?.graphiql ?? DEFAULT_API.graphiql,
    },
    auth: {
      secret: validated.auth?.secret,
      accessTokenTTL: validated.auth?.accessTokenTTL ?? DEFAULT_AUTH.accessTokenTTL,
      refreshTokenTTL: validated.auth?.refreshTokenTTL ?? DEFAULT_AUTH.refreshTokenTTL,
      strategies: validated.auth?.strategies ?? DEFAULT_AUTH.strategies,
    },
    tenancy: {
      enabled: validated.tenancy?.enabled ?? DEFAULT_TENANCY.enabled,
      resolution: validated.tenancy?.resolution ?? DEFAULT_TENANCY.resolution,
      header: validated.tenancy?.header ?? DEFAULT_TENANCY.header,
    },
  } as ProjectConfig;
}
