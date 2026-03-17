import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');
const COMPOSE_FILE = resolve(PROJECT_ROOT, 'compose.yaml');

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 2_000 });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

/**
 * Start the Postgres container using Docker Compose.
 * The --wait flag blocks until the healthcheck passes.
 * Idempotent: calling when already running is safe.
 * Skipped when Postgres is already reachable (e.g. CI service container).
 */
export async function startPostgres(): Promise<void> {
  if (await isPortOpen('localhost', 5432)) return;
  execSync(`docker compose -f "${COMPOSE_FILE}" up -d --wait`, {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    timeout: 60_000,
  });
}

/**
 * Stop the Postgres container and remove volumes for a clean teardown.
 */
export async function stopPostgres(): Promise<void> {
  execSync(`docker compose -f "${COMPOSE_FILE}" down -v`, {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    timeout: 30_000,
  });
}

/**
 * Vitest globalSetup — called before any test file runs.
 *
 * Teardown is skipped by default because turbo may run multiple
 * packages in parallel; the first to finish would kill the container
 * for the others.  Set SA_DOCKER_TEARDOWN=true to enable teardown
 * (useful in CI where only one vitest invocation runs).
 */
export default async function setup(): Promise<() => Promise<void>> {
  await startPostgres();
  return async () => {
    if (process.env['SA_DOCKER_TEARDOWN'] === 'true') {
      await stopPostgres();
    }
  };
}
