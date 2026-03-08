import type { ConnectionPool, RelationMeta } from '@simplicity-admin/core';
import { DatabaseError } from '../errors.js';

/**
 * Introspects foreign key constraints in the given schema.
 * Returns both directions for each FK: many-to-one and one-to-many.
 */
export async function introspectRelations(
  pool: ConnectionPool,
  schema = 'public',
): Promise<RelationMeta[]> {
  try {
    const result = await pool.query<{
      constraint_name: string;
      from_table: string;
      from_columns: string[];
      to_table: string;
      to_columns: string[];
    }>(
      `SELECT
        con.conname AS constraint_name,
        src.relname AS from_table,
        ARRAY(
          SELECT a.attname::text
          FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) AS from_columns,
        tgt.relname AS to_table,
        ARRAY(
          SELECT a.attname::text
          FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) AS to_columns
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
      JOIN pg_catalog.pg_class tgt ON tgt.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns ON ns.oid = con.connamespace
      WHERE con.contype = 'f'
        AND ns.nspname = $1
      ORDER BY src.relname, con.conname`,
      [schema],
    );

    const relations: RelationMeta[] = [];

    for (const row of result.rows) {
      // many-to-one: from FK table to referenced table
      relations.push({
        name: row.constraint_name,
        fromTable: row.from_table,
        fromColumns: row.from_columns,
        toTable: row.to_table,
        toColumns: row.to_columns,
        type: 'many-to-one',
      });

      // one-to-many: reverse direction
      relations.push({
        name: row.constraint_name,
        fromTable: row.to_table,
        fromColumns: row.to_columns,
        toTable: row.from_table,
        toColumns: row.from_columns,
        type: 'one-to-many',
      });
    }

    return relations;
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Failed to introspect relations in schema "${schema}": ${err instanceof Error ? err.message : String(err)}`,
      'DB_003',
      err instanceof Error ? err : undefined,
    );
  }
}
