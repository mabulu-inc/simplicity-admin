import pg from 'pg';
import { postgraphile } from 'postgraphile';
import { grafserv } from 'grafserv/node';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { makePgService } from '@dataplan/pg/adaptors/pg';
import type {
  HttpHandler,
  ConnectionPool,
  ProjectConfig,
  SchemaMeta,
} from '@mabulu-inc/simplicity-admin-core';
import { createPgSettingsFromToken } from './graphql/pg-settings.js';

const { Pool } = pg;

export interface APIServerResult {
  handler: HttpHandler;
  close: () => Promise<void>;
}

export async function createAPIServer(
  _pool: ConnectionPool,
  _meta: SchemaMeta,
  config: ProjectConfig,
): Promise<APIServerResult> {
  const rawPool = new Pool({ connectionString: config.database });
  const schema = config.schema ?? 'public';

  const preset: GraphileConfig.Preset = {
    extends: [PostGraphileAmberPreset],
    pgServices: [
      makePgService({
        pool: rawPool,
        schemas: [schema],
      }),
    ],
    grafserv: {
      graphiql: config.api?.graphiql ?? false,
    },
    grafast: {
      context(requestContext) {
        const req = requestContext?.node?.req;
        if (req) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification: auth middleware attaches .user to the request, which is not reflected in Grafserv's IncomingMessage type
          const user = (req as any).user;
          if (user) {
            return {
              pgSettings: createPgSettingsFromToken({
                userId: user.userId,
                tenantId: user.tenantId,
                roles: user.roles ?? [],
                activeRole: user.activeRole,
                superAdmin: user.superAdmin,
                authStrategy: 'password',
              }),
            };
          }
        }
        return {};
      },
    },
  };

  const pgl = postgraphile(preset);
  const serv = pgl.createServ(grafserv);
  const nodeHandler = serv.createHandler();

  const handler: HttpHandler = (req, res) => {
    nodeHandler(req, res);
  };

  const close = async () => {
    await pgl.release();
    await rawPool.end();
  };

  return { handler, close };
}
