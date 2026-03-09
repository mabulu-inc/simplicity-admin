// @simplicity-admin/cli — programmatic API

import type { ProjectConfig, HttpHandler } from '@simplicity-admin/core';
import type { Server } from 'node:http';

/**
 * Create an HTTP handler that mounts the full admin suite (API + UI).
 * For use as middleware in existing servers:
 *   app.use('/admin', createAdmin({ database: url }))
 */
export function createAdmin(_config: Partial<ProjectConfig>): HttpHandler {
  // Implementation will be added when API + UI packages are wired up
  return (_req, res) => {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not yet implemented' }));
  };
}

/**
 * Start a standalone admin server.
 */
export async function startServer(_config: Partial<ProjectConfig>): Promise<Server> {
  // Implementation will be added when API + UI packages are wired up
  const { createServer } = await import('node:http');
  const handler = createAdmin(_config);
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, () => {
      resolve(server);
    });
  });
}
