import { createServer } from 'node:http';
import { loadConfig } from '@simplicity-admin/core';
import { createPool, bootstrap, introspectSchema } from '@simplicity-admin/db';
import { createAPIServer } from '@simplicity-admin/api';
import {
  createAuthMiddleware,
  jwtTokenProvider,
  createLoginHandler,
  createLogoutHandler,
  createRefreshHandler,
} from '@simplicity-admin/auth';
import type {
  ProjectConfig,
  HttpHandler,
  ConnectionPool,
} from '@simplicity-admin/core';

/**
 * Run the dev server: load config, bootstrap DB, start API + auth.
 */
export async function runDev(_args: string[]): Promise<void> {
  // 1. Load config
  let config: ProjectConfig;
  try {
    config = await loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      process.stderr.write(
        'No config file found. Run `npx simplicity-admin init` first or create simplicity-admin.config.ts\n',
      );
    } else {
      process.stderr.write(`Failed to load config: ${message}\n`);
    }
    process.exit(1);
  }

  // 2. Connect to database
  let pool: ConnectionPool;
  try {
    pool = createPool(config.database);
    // Verify the connection works
    await pool.query('SELECT 1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Cannot connect to database: ${message}. Is PostgreSQL running?\n`,
    );
    process.exit(1);
  }

  // 3. Bootstrap database
  process.stdout.write('Bootstrapping database...\n');
  try {
    await bootstrap(pool, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Database bootstrap failed: ${message}\n`);
    await pool.end();
    process.exit(1);
  }

  // 4. Introspect schema
  const schema = config.schema ?? 'public';
  const meta = await introspectSchema(pool, schema);

  // 5. Create API server
  const { handler: apiHandler, close: closeAPI } = await createAPIServer(
    pool,
    meta,
    { ...config, api: { ...config.api, graphiql: true } },
  );

  // 6. Auth middleware + routes
  const systemSchema = config.systemSchema ?? config.schema ?? 'public';
  const tokenProvider = jwtTokenProvider(config.auth);
  const authMiddleware = createAuthMiddleware(tokenProvider, pool, config);
  const loginHandler = createLoginHandler(tokenProvider, pool, systemSchema);
  const logoutHandler = createLogoutHandler(tokenProvider, pool, systemSchema);
  const refreshHandler = createRefreshHandler(tokenProvider);

  // 7. Compose HTTP handler
  const basePath = config.basePath ?? '';
  const graphqlPath = `${basePath}/api/graphql`;
  const loginPath = `${basePath}/api/auth/login`;
  const logoutPath = `${basePath}/api/auth/logout`;
  const refreshPath = `${basePath}/api/auth/refresh`;

  const handler: HttpHandler = async (req, res) => {
    const url = req.url ?? '/';

    // Auth routes (no middleware needed)
    if (url.startsWith(loginPath) && req.method === 'POST') {
      await loginHandler(req, res);
      return;
    }
    if (url.startsWith(logoutPath) && req.method === 'POST') {
      await logoutHandler(req, res);
      return;
    }
    if (url.startsWith(refreshPath) && req.method === 'POST') {
      await refreshHandler(req, res);
      return;
    }

    // Apply auth middleware for all other routes
    let authDone = false;
    await authMiddleware(req, res, () => {
      authDone = true;
    });
    if (!authDone) return; // middleware sent a response

    // GraphQL
    if (url.startsWith(graphqlPath)) {
      await apiHandler(req, res);
      return;
    }

    // Admin UI placeholder (SvelteKit will be mounted here later)
    if (url.startsWith(`${basePath}/admin`)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>SIMPLICITY-ADMIN</h1><p>UI coming soon. Use GraphQL at /api/graphql</p></body></html>');
      return;
    }

    // Default: redirect to admin
    res.writeHead(302, { Location: `${basePath}/admin` });
    res.end();
  };

  // 8. Start server
  const port = config.port ?? 3000;
  const server = createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      resolve();
    });
  });

  const actualPort = (server.address() as { port: number }).port;
  printBanner(actualPort, basePath);

  // 9. Graceful shutdown
  const cleanup = async () => {
    process.stdout.write('\nShutting down...\n');
    server.close();
    await closeAPI();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function printBanner(port: number, basePath: string): void {
  const banner = `
  SIMPLICITY-ADMIN dev server running:

  Admin UI:  http://localhost:${port}${basePath}/admin
  GraphQL:   http://localhost:${port}${basePath}/api/graphql
  GraphiQL:  http://localhost:${port}${basePath}/api/graphql (browser)

  Default login: admin@localhost / changeme
`;
  process.stdout.write(banner);
}
