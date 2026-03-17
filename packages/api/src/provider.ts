import type {
  APIProvider,
  HttpHandler,
  ConnectionPool,
  SchemaMeta,
  APIConfig,
  ProjectConfig,
} from '@mabulu-inc/simplicity-admin-core';
import { createAPIServer } from './server.js';

export function postgraphileProvider(): APIProvider {
  let closeServer: (() => Promise<void>) | null = null;

  return {
    name: 'postgraphile',
    version: '0.0.1',

    async createHandler(
      pool: ConnectionPool,
      meta: SchemaMeta,
      config: APIConfig,
    ): Promise<HttpHandler> {
      // Build a minimal ProjectConfig from APIConfig for createAPIServer
      // In practice, the full config is passed through the app orchestrator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification: __projectConfig is an internal convention to pass ProjectConfig through the APIConfig interface without widening its public API
      const fullConfig = (config as any).__projectConfig as ProjectConfig | undefined;
      if (!fullConfig) {
        throw new Error(
          'postgraphileProvider requires a ProjectConfig. Pass config via __projectConfig.',
        );
      }

      const result = await createAPIServer(pool, meta, fullConfig);
      closeServer = result.close;
      return result.handler;
    },

    async shutdown() {
      if (closeServer) {
        await closeServer();
        closeServer = null;
      }
    },
  };
}
