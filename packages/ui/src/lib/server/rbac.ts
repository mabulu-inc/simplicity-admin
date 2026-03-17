// Server-side RBAC utilities for filtering columns/operations by role permissions.

import type { TableMeta, ColumnMeta, ConnectionPool } from '@mabulu-inc/simplicity-admin-core';
import {
	getEffectivePermissions,
	getAccessibleColumns,
	canAccess,
	listOverrides,
	mergeOverrides,
} from '@mabulu-inc/simplicity-admin-auth';
import type { EffectivePermissions } from '@mabulu-inc/simplicity-admin-auth';

export interface TableRbacInfo {
	/** Columns the user can SELECT (visible in list/detail views) */
	visibleColumns: ColumnMeta[];
	/** Column names that are read-only in edit mode (SELECT but not UPDATE) */
	readOnlyColumns: string[];
	/** Column names that are hidden (no SELECT permission) */
	hiddenColumns: string[];
	/** Whether the user can INSERT into this table */
	canInsert: boolean;
	/** Whether the user can UPDATE records in this table */
	canUpdate: boolean;
	/** Whether the user can DELETE records from this table */
	canDelete: boolean;
}

/**
 * Get RBAC-filtered table info for a given role and table.
 * Reads effective permissions (code grants + UI overrides) and determines
 * which columns are visible, read-only, or hidden, and which operations are allowed.
 */
export async function getTableRbacInfo(
	pool: ConnectionPool,
	role: string,
	table: TableMeta,
	schema: string,
): Promise<TableRbacInfo> {
	// Fetch code-defined permissions
	const codePerms = await getEffectivePermissions(pool, role, schema);

	// Fetch UI overrides and merge
	const overrides = await listOverrides(pool, role);
	const perms: EffectivePermissions = mergeOverrides(codePerms, overrides);

	// Determine accessible columns for each operation
	const selectCols = new Set(getAccessibleColumns(perms, table.name, 'SELECT'));
	const updateCols = new Set(getAccessibleColumns(perms, table.name, 'UPDATE'));

	const visibleColumns: ColumnMeta[] = [];
	const readOnlyColumns: string[] = [];
	const hiddenColumns: string[] = [];

	for (const col of table.columns) {
		if (selectCols.has(col.name)) {
			visibleColumns.push(col);
			// Read-only if can SELECT but not UPDATE
			if (!updateCols.has(col.name)) {
				readOnlyColumns.push(col.name);
			}
		} else {
			hiddenColumns.push(col.name);
		}
	}

	return {
		visibleColumns,
		readOnlyColumns,
		hiddenColumns,
		canInsert: canAccess(perms, table.name, 'INSERT'),
		canUpdate: canAccess(perms, table.name, 'UPDATE'),
		canDelete: canAccess(perms, table.name, 'DELETE'),
	};
}
