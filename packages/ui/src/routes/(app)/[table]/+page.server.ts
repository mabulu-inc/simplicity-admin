import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';
import { getTableRbacInfo } from '$lib/server/rbac.js';
import { escapeIdentifier } from '@mabulu-inc/simplicity-admin-db';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const tableName = params.table;
	const meta = await getSchemaMeta();
	const table = getTableMeta(meta, tableName);

	if (!table) {
		throw error(404, `Table "${tableName}" not found`);
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
	const sortColumn = url.searchParams.get('sort') ?? undefined;
	const sortDirection = (url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

	const pool = getPool();

	// Get RBAC info for the current user's active role
	const role = locals.user?.activeRole;
	const rbac = role
		? await getTableRbacInfo(pool, role, table, SCHEMA)
		: null;

	// Use RBAC-filtered columns if available, otherwise fall back to all columns
	const columns = rbac ? rbac.visibleColumns : table.columns;

	const sort = sortColumn && columns.some((c) => c.name === sortColumn)
		? { column: sortColumn, direction: sortDirection }
		: undefined;

	const offset = (page - 1) * pageSize;

	// Build column list for SELECT (only accessible columns)
	const columnNames = columns.map((c) => escapeIdentifier(c.name)).join(', ');

	// Build ORDER BY clause
	let orderBy = '';
	if (sort) {
		orderBy = `ORDER BY ${escapeIdentifier(sort.column)} ${sort.direction.toUpperCase()}`;
	} else if (table.primaryKey.length > 0) {
		orderBy = `ORDER BY ${escapeIdentifier(table.primaryKey[0])} DESC`;
	}

	const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;

	// Run count and data queries in parallel
	const [countResult, dataResult] = await Promise.all([
		pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${qualifiedTable}`),
		pool.query(
			`SELECT ${columnNames} FROM ${qualifiedTable} ${orderBy} LIMIT $1 OFFSET $2`,
			[pageSize, offset],
		),
	]);

	const totalCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

	return {
		table: {
			...table,
			columns,
		},
		rows: dataResult.rows as Record<string, unknown>[],
		totalCount,
		page,
		pageSize,
		sort,
		canInsert: rbac?.canInsert ?? true,
		canDelete: rbac?.canDelete ?? true,
	};
};
