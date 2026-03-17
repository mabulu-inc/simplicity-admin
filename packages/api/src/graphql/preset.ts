import type { GraphileConfig } from 'graphile-config';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { makePgService } from '@dataplan/pg/adaptors/pg';
import type { APIConfig, ConnectionPool } from '@mabulu-inc/simplicity-admin-core';
import {
  makeDepthLimitPlugin,
  DEFAULT_MAX_DEPTH,
} from './depth-limit.js';

export function createPreset(
  config: APIConfig,
  pool: ConnectionPool,
): GraphileConfig.Preset {
  // The pool from @mabulu-inc/simplicity-admin-db wraps pg.Pool — extract the underlying pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification: ConnectionPool wraps pg.Pool but does not expose the underlying instance; _pool is needed by makePgService which requires a raw pg.Pool
  const rawPool = (pool as any)._pool ?? pool;

  const pgService = makePgService({
    pool: rawPool,
    schemas: ['public'],
  });

  const maxDepth = config.maxQueryDepth ?? DEFAULT_MAX_DEPTH;

  return {
    extends: [PostGraphileAmberPreset],
    plugins: [makeDepthLimitPlugin(maxDepth)],
    pgServices: [pgService],
    grafserv: {
      graphiql: config.graphiql ?? false,
    },
  };
}
