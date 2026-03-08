import type { ColumnMeta, ConnectionPool } from '@simplicity-admin/core';
import { mapPgType } from '@simplicity-admin/core';
import { DatabaseError } from '../errors.js';

/**
 * Introspects columns for a given table, returning full ColumnMeta[] with
 * type mapping, nullable, defaults, primary key, enum values, generated status,
 * maxLength, precision, and scale.
 */
export async function introspectColumns(
  pool: ConnectionPool,
  tableName: string,
  schema = 'public',
): Promise<ColumnMeta[]> {
  try {
    // Main column query using information_schema + pg_catalog
    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_generated: string;
      column_comment: string | null;
    }>(
      `SELECT
        c.column_name,
        c.udt_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_generated,
        col_description(
          (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
          c.ordinal_position
        ) AS column_comment
      FROM information_schema.columns c
      WHERE c.table_schema = $1
        AND c.table_name = $2
      ORDER BY c.ordinal_position`,
      [schema, tableName],
    );

    if (result.rows.length === 0) {
      return [];
    }

    // Get primary key columns
    const pkResult = await pool.query<{ column_name: string }>(
      `SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
        AND i.indisprimary`,
      [schema, tableName],
    );
    const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));

    // Get enum values for any enum columns
    const enumColumns = result.rows.filter((r) => r.data_type === 'USER-DEFINED');
    const enumValuesMap = new Map<string, string[]>();

    for (const col of enumColumns) {
      const enumResult = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = $1
          AND n.nspname = $2
        ORDER BY e.enumsortorder`,
        [col.udt_name, schema],
      );
      enumValuesMap.set(col.column_name, enumResult.rows.map((r) => r.enumlabel));
    }

    return result.rows.map((row): ColumnMeta => {
      const isEnum = row.data_type === 'USER-DEFINED' && enumValuesMap.has(row.column_name);
      const isArray = row.data_type === 'ARRAY';

      // For arrays, udt_name starts with '_' (e.g. '_text' for text[])
      let pgType: string;
      if (isEnum) {
        pgType = row.udt_name;
      } else if (isArray) {
        pgType = row.udt_name.replace(/^_/, '') + '[]';
      } else {
        pgType = row.udt_name;
      }

      const type = isEnum ? 'enum' as const : mapPgType(isArray ? pgType : row.udt_name);

      const meta: ColumnMeta = {
        name: row.column_name,
        type,
        pgType,
        nullable: row.is_nullable === 'YES',
        hasDefault: row.column_default !== null,
        defaultValue: row.column_default,
        isPrimaryKey: pkColumns.has(row.column_name),
        isGenerated: row.is_generated === 'ALWAYS',
        comment: row.column_comment ?? null,
      };

      if (isEnum) {
        meta.enumValues = enumValuesMap.get(row.column_name);
      }

      if (isArray) {
        const elementType = row.udt_name.replace(/^_/, '');
        meta.arrayElementType = mapPgType(elementType);
      }

      if (row.character_maximum_length !== null) {
        meta.maxLength = row.character_maximum_length;
      }

      if (row.numeric_precision !== null) {
        meta.precision = row.numeric_precision;
      }

      if (row.numeric_scale !== null) {
        meta.scale = row.numeric_scale;
      }

      return meta;
    });
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    throw new DatabaseError(
      `Failed to introspect columns for "${schema}"."${tableName}": ${err instanceof Error ? err.message : String(err)}`,
      'DB_003',
      err instanceof Error ? err : undefined,
    );
  }
}
