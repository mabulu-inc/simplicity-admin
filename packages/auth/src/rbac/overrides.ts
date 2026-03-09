import type { ConnectionPool } from '@simplicity-admin/core';
import type { EffectivePermissions, Operation } from './types.js';
import { AuthError } from '../errors.js';

export interface PermissionOverride {
  id: string;
  role: string;
  table: string;
  column?: string;
  operation: Operation;
  denied: boolean;
  createdBy: string;
  createdAt: Date;
}

/** Input type for creating an override (id and createdAt are auto-generated) */
type NewOverride = Omit<PermissionOverride, 'id' | 'createdAt'>;

/** Default system schema where permission overrides table lives */
const DEFAULT_SYSTEM_SCHEMA = 'simplicity_admin';

function overridesTable(systemSchema = DEFAULT_SYSTEM_SCHEMA): string {
  return `"${systemSchema}"."simplicity_permission_overrides"`;
}

/**
 * Save a UI-defined permission override.
 * Only deny overrides are allowed — attempting to grant (denied: false)
 * throws an RBAC_003 error because UI can never expand beyond code ceiling.
 */
export async function saveOverride(
  pool: ConnectionPool,
  override: NewOverride,
  systemSchema?: string,
): Promise<PermissionOverride> {
  // UI overrides can only DENY, never GRANT
  if (!override.denied) {
    throw new AuthError(
      'Cannot grant permissions beyond code-defined ceiling',
      'RBAC_003',
    );
  }

  const result = await pool.query<{
    id: string;
    role: string;
    table_name: string;
    column_name: string | null;
    operation: string;
    denied: boolean;
    created_by: string;
    created_at: Date;
  }>(
    `INSERT INTO ${overridesTable(systemSchema)}
       (role, table_name, column_name, operation, denied, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, role, table_name, column_name, operation, denied, created_by, created_at`,
    [
      override.role,
      override.table,
      override.column ?? null,
      override.operation,
      override.denied,
      override.createdBy,
    ],
  );

  const row = result.rows[0]!;
  return mapRow(row);
}

/**
 * Remove a UI-defined override by ID.
 * This restores the code-defined permission for the affected role/table/column.
 */
export async function removeOverride(
  pool: ConnectionPool,
  overrideId: string,
  systemSchema?: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM ${overridesTable(systemSchema)} WHERE id = $1`,
    [overrideId],
  );
}

/**
 * List all UI-defined overrides for a given role.
 */
export async function listOverrides(
  pool: ConnectionPool,
  role: string,
  systemSchema?: string,
): Promise<PermissionOverride[]> {
  const result = await pool.query<{
    id: string;
    role: string;
    table_name: string;
    column_name: string | null;
    operation: string;
    denied: boolean;
    created_by: string;
    created_at: Date;
  }>(
    `SELECT id, role, table_name, column_name, operation, denied, created_by, created_at
     FROM ${overridesTable(systemSchema)}
     WHERE role = $1
     ORDER BY table_name, column_name, operation`,
    [role],
  );

  return result.rows.map(mapRow);
}

/**
 * Merge UI deny-overrides into code-defined effective permissions.
 * Returns a new EffectivePermissions with denied operations removed.
 * Does not mutate the input.
 */
export function mergeOverrides(
  codePermissions: EffectivePermissions,
  overrides: PermissionOverride[],
): EffectivePermissions {
  if (overrides.length === 0) return codePermissions;

  // Deep-clone so we don't mutate the input
  const merged: EffectivePermissions = {
    role: codePermissions.role,
    tables: codePermissions.tables.map(tp => ({
      ...tp,
      operations: [...tp.operations],
      columnPermissions: tp.columnPermissions.map(cp => ({
        ...cp,
        operations: [...cp.operations],
      })),
    })),
  };

  for (const override of overrides) {
    if (!override.denied) continue;

    const tp = merged.tables.find(t => t.table === override.table);
    if (!tp) continue;

    if (override.column) {
      // Column-level deny: remove the operation from that column only
      const cp = tp.columnPermissions.find(c => c.column === override.column);
      if (cp) {
        cp.operations = cp.operations.filter(op => op !== override.operation);
      }
    } else {
      // Table-level deny: remove the operation from the table and ALL columns
      tp.operations = tp.operations.filter(op => op !== override.operation);
      for (const cp of tp.columnPermissions) {
        cp.operations = cp.operations.filter(op => op !== override.operation);
      }
    }
  }

  return merged;
}

/** Map a database row to a PermissionOverride */
function mapRow(row: {
  id: string;
  role: string;
  table_name: string;
  column_name: string | null;
  operation: string;
  denied: boolean;
  created_by: string;
  created_at: Date;
}): PermissionOverride {
  return {
    id: row.id,
    role: row.role,
    table: row.table_name,
    column: row.column_name ?? undefined,
    operation: row.operation as Operation,
    denied: row.denied,
    createdBy: row.created_by,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
