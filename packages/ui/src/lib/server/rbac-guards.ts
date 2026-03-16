// Server-side RBAC guard functions for mutation endpoints.
// These enforce permissions server-side, preventing bypasses via crafted POST requests.

import { error } from '@sveltejs/kit';
import type { TableRbacInfo } from './rbac.js';

type SessionUser = App.Locals['user'];

/**
 * Require an authenticated user. Throws 401 if user is undefined.
 */
export function requireAuth(user: SessionUser): NonNullable<SessionUser> {
	if (!user) {
		throw error(401, 'Authentication required');
	}
	return user;
}

/**
 * Require INSERT permission. Throws 403 if the role cannot insert.
 */
export function requireInsert(rbac: TableRbacInfo): void {
	if (!rbac.canInsert) {
		throw error(403, 'Permission denied');
	}
}

/**
 * Require UPDATE permission. Throws 403 if the role cannot update.
 */
export function requireUpdate(rbac: TableRbacInfo): void {
	if (!rbac.canUpdate) {
		throw error(403, 'Permission denied');
	}
}

/**
 * Require DELETE permission. Throws 403 if the role cannot delete.
 */
export function requireDelete(rbac: TableRbacInfo): void {
	if (!rbac.canDelete) {
		throw error(403, 'Permission denied');
	}
}

/**
 * Get the set of column names that the current role can write to.
 * Excludes read-only columns, hidden columns, and primary key columns.
 */
export function getWritableColumnNames(rbac: TableRbacInfo): Set<string> {
	const readOnly = new Set(rbac.readOnlyColumns);
	const writable = new Set<string>();

	for (const col of rbac.visibleColumns) {
		if (col.isPrimaryKey) continue;
		if (readOnly.has(col.name)) continue;
		writable.add(col.name);
	}

	return writable;
}
