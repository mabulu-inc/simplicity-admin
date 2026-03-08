import type { GraphileConfig } from 'graphile-config';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { makePgService } from '@dataplan/pg/adaptors/pg';
import type { APIConfig, ConnectionPool } from '@simplicity-admin/core';

export function createPreset(
  config: APIConfig,
  pool: ConnectionPool,
): GraphileConfig.Preset {
  // The pool from @simplicity-admin/db wraps pg.Pool — extract the underlying pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPool = (pool as any)._pool ?? pool;

  const pgService = makePgService({
    pool: rawPool,
    schemas: ['public'],
  });

  return {
    extends: [PostGraphileAmberPreset],
    pgServices: [pgService],
    grafserv: {
      graphiql: config.graphiql ?? false,
    },
  };
}
