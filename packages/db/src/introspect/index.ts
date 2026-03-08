import type { ConnectionPool, SchemaMeta } from '@simplicity-admin/core';
import { DatabaseError } from '../errors.js';
import { listTables } from './tables.js';
import { introspectColumns } from './columns.js';
import { introspectRelations } from './relations.js';
import { introspectEnums } from './enums.js';

/**
 * Assembles a complete SchemaMeta by orchestrating all introspection functions.
 * Lists tables, then populates columns on each, and fetches relations and enums.
 */
export async function introspectSchema(
  pool: ConnectionPool,
  schema = 'public',
): Promise<SchemaMeta> {
  try {
    // Fetch tables, relations, and enums in parallel
    const [tables, relations, enums] = await Promise.all([
      listTables(pool, schema),
      introspectRelations(pool, schema),
      introspectEnums(pool, schema),
    ]);

    // Populate columns and primary keys on each table in parallel
    await Promise.all(
      tables.map(async (table) => {
        const columns = await introspectColumns(pool, table.name, schema);
        table.columns = columns;
        table.primaryKey = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
      }),
    );

    return { tables, relations, enums };
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Failed to introspect schema "${schema}": ${err instanceof Error ? err.message : String(err)}`,
      'DB_003',
      err instanceof Error ? err : undefined,
    );
  }
}
