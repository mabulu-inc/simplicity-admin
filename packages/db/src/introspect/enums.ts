import type { ConnectionPool, EnumMeta } from '@simplicity-admin/core';
import { DatabaseError } from '../errors.js';

/**
 * Introspects user-defined enum types in the given schema.
 * Returns enum names and their values in defined sort order.
 */
export async function introspectEnums(
  pool: ConnectionPool,
  schema = 'public',
): Promise<EnumMeta[]> {
  try {
    const result = await pool.query<{
      enum_name: string;
      enum_schema: string;
      enum_values: string[];
    }>(
      `SELECT
        t.typname AS enum_name,
        n.nspname AS enum_schema,
        ARRAY(
          SELECT e.enumlabel::text
          FROM pg_catalog.pg_enum e
          WHERE e.enumtypid = t.oid
          ORDER BY e.enumsortorder
        ) AS enum_values
      FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e'
        AND n.nspname = $1
      ORDER BY t.typname`,
      [schema],
    );

    return result.rows.map((row) => ({
      name: row.enum_name,
      schema: row.enum_schema,
      values: row.enum_values,
    }));
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Failed to introspect enums in schema "${schema}": ${err instanceof Error ? err.message : String(err)}`,
      'DB_003',
      err instanceof Error ? err : undefined,
    );
  }
}
