import type { ConnectionPool } from '@mabulu-inc/simplicity-admin-core';
import type {
  Operation,
  EffectivePermissions,
  TablePermission,
} from './types.js';

/**
 * Checks if a role can perform an operation on a table.
 * Pure function — operates on pre-fetched EffectivePermissions.
 */
export function canAccess(
  permissions: EffectivePermissions,
  table: string,
  operation: Operation,
): boolean {
  const tp = permissions.tables.find(t => t.table === table);
  if (!tp) return false;
  return tp.operations.includes(operation);
}

/**
 * Checks if a role can perform an operation on a specific column.
 * Pure function — operates on pre-fetched EffectivePermissions.
 */
export function canAccessColumn(
  permissions: EffectivePermissions,
  table: string,
  column: string,
  operation: Operation,
): boolean {
  const tp = permissions.tables.find(t => t.table === table);
  if (!tp) return false;
  const cp = tp.columnPermissions.find(c => c.column === column);
  if (!cp) return false;
  return cp.operations.includes(operation);
}

/**
 * Returns the list of columns a role can access for a given table and operation.
 * Pure function — operates on pre-fetched EffectivePermissions.
 */
export function getAccessibleColumns(
  permissions: EffectivePermissions,
  table: string,
  operation: Operation,
): string[] {
  const tp = permissions.tables.find(t => t.table === table);
  if (!tp) return [];
  return tp.columnPermissions
    .filter(cp => cp.operations.includes(operation))
    .map(cp => cp.column);
}

/**
 * Reads effective permissions from the database for a given PostgreSQL role.
 * Queries information_schema to discover table-level and column-level grants.
 *
 * This reads the CODE-DEFINED permissions (PostgreSQL grants).
 * UI overrides are handled separately by the overrides module.
 */
export async function getEffectivePermissions(
  pool: ConnectionPool,
  role: string,
  schema?: string,
): Promise<EffectivePermissions> {
  // Query table-level privileges
  const tablePrivQuery = `
    SELECT table_schema, table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = $1
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      ${schema ? 'AND table_schema = $2' : ''}
    ORDER BY table_schema, table_name, privilege_type
  `;
  const tableParams: unknown[] = schema ? [role, schema] : [role];
  const tableResult = await pool.query<{
    table_schema: string;
    table_name: string;
    privilege_type: string;
  }>(tablePrivQuery, tableParams);

  // Query column-level privileges
  const colPrivQuery = `
    SELECT table_schema, table_name, column_name, privilege_type
    FROM information_schema.role_column_grants
    WHERE grantee = $1
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      ${schema ? 'AND table_schema = $2' : ''}
    ORDER BY table_schema, table_name, column_name, privilege_type
  `;
  const colParams: unknown[] = schema ? [role, schema] : [role];
  const colResult = await pool.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    privilege_type: string;
  }>(colPrivQuery, colParams);

  // Build a map of table key -> TablePermission
  const tableMap = new Map<string, TablePermission>();

  for (const row of tableResult.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    let tp = tableMap.get(key);
    if (!tp) {
      tp = {
        table: row.table_name,
        schema: row.table_schema,
        operations: [],
        columnPermissions: [],
      };
      tableMap.set(key, tp);
    }
    const op = row.privilege_type as Operation;
    if (!tp.operations.includes(op)) {
      tp.operations.push(op);
    }
  }

  // Add column-level privileges
  // Column grants may also imply table-level access for that operation
  for (const row of colResult.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    let tp = tableMap.get(key);
    if (!tp) {
      tp = {
        table: row.table_name,
        schema: row.table_schema,
        operations: [],
        columnPermissions: [],
      };
      tableMap.set(key, tp);
    }

    const op = row.privilege_type as Operation;

    // Ensure the operation is listed at the table level
    if (!tp.operations.includes(op)) {
      tp.operations.push(op);
    }

    // Find or create column permission
    let cp = tp.columnPermissions.find(c => c.column === row.column_name);
    if (!cp) {
      cp = { column: row.column_name, operations: [] };
      tp.columnPermissions.push(cp);
    }
    if (!cp.operations.includes(op)) {
      cp.operations.push(op);
    }
  }

  // For table-level grants (no column restrictions), we need to fetch the actual
  // columns from the database so we can populate columnPermissions
  for (const tp of tableMap.values()) {
    // Find operations that have table-level grants but no column-level grants yet
    const opsWithColumnGrants = new Set(
      tp.columnPermissions.flatMap(cp => cp.operations),
    );

    const opsNeedingColumns = tp.operations.filter(
      op => !opsWithColumnGrants.has(op) || tp.columnPermissions.length === 0,
    );

    if (opsNeedingColumns.length > 0) {
      // Fetch all columns for this table
      const colQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
      `;
      const colsResult = await pool.query<{ column_name: string }>(
        colQuery,
        [tp.schema, tp.table],
      );

      for (const colRow of colsResult.rows) {
        let cp = tp.columnPermissions.find(c => c.column === colRow.column_name);
        if (!cp) {
          cp = { column: colRow.column_name, operations: [] };
          tp.columnPermissions.push(cp);
        }
        for (const op of opsNeedingColumns) {
          if (!cp.operations.includes(op)) {
            cp.operations.push(op);
          }
        }
      }
    }
  }

  return {
    role,
    tables: Array.from(tableMap.values()),
  };
}
