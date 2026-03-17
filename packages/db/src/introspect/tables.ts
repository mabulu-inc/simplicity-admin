import type { ConnectionPool, TableMeta } from '@mabulu-inc/simplicity-admin-core';
import { DatabaseError } from '../errors.js';

/**
 * Lists all user tables in the given schema, excluding system tables.
 * Returns TableMeta[] with name, schema, and comment populated.
 * columns and primaryKey are left empty (populated by introspectColumns).
 */
export async function listTables(
  pool: ConnectionPool,
  schema = 'public',
): Promise<TableMeta[]> {
  try {
    const result = await pool.query<{ table_name: string; table_comment: string | null }>(
      `SELECT
        c.relname AS table_name,
        obj_description(c.oid) AS table_comment
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1
        AND c.relkind = 'r'
        AND c.relname NOT LIKE 'pg_%'
      ORDER BY c.relname`,
      [schema],
    );

    return result.rows.map((row) => ({
      name: row.table_name,
      schema,
      columns: [],
      primaryKey: [],
      comment: row.table_comment ?? null,
    }));
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Failed to list tables in schema "${schema}": ${err instanceof Error ? err.message : String(err)}`,
      'DB_003',
      err instanceof Error ? err : undefined,
    );
  }
}
