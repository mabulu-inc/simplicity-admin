import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';

export const load: PageServerLoad = async ({ params, url }) => {
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

	const sort = sortColumn && table.columns.some((c) => c.name === sortColumn)
		? { column: sortColumn, direction: sortDirection }
		: undefined;

	const offset = (page - 1) * pageSize;
	const pool = getPool();

	// Build column list for SELECT (use all columns)
	const columnNames = table.columns.map((c) => `"${c.name}"`).join(', ');

	// Build ORDER BY clause
	let orderBy = '';
	if (sort) {
		orderBy = `ORDER BY "${sort.column}" ${sort.direction.toUpperCase()}`;
	} else if (table.primaryKey.length > 0) {
		orderBy = `ORDER BY "${table.primaryKey[0]}" DESC`;
	}

	const qualifiedTable = `"${SCHEMA}"."${tableName}"`;

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
		table,
		rows: dataResult.rows as Record<string, unknown>[],
		totalCount,
		page,
		pageSize,
		sort,
	};
};
