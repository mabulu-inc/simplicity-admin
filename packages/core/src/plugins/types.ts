// packages/core/src/plugins/types.ts — Plugin interfaces

import type { ProjectConfig } from '../config/types.js';
import type { SchemaMeta } from '../metadata/types.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { IncomingMessage } from 'node:http';

export interface Plugin {
  name: string;
  version: string;
  onInit?(config: ProjectConfig): Promise<void>;
  onSchemaLoaded?(meta: SchemaMeta): Promise<SchemaMeta>;
  onReady?(ctx: AppContext): Promise<void>;
  onRequest?(req: IncomingMessage, ctx: RequestContext): Promise<void>;
  onShutdown?(): Promise<void>;
}

export interface AppContext {
  config: ProjectConfig;
  registry: ProviderRegistry;
  meta: SchemaMeta;
}

export interface RequestContext {
  userId?: string;
  tenantId?: string;
  roles?: string[];
  activeRole?: string;
  superAdmin?: boolean;
}
