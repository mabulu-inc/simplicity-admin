import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';
import { getTableRbacInfo } from '$lib/server/rbac.js';
import { requireAuth, requireInsert, getWritableColumnNames } from '$lib/server/rbac-guards.js';
import { escapeIdentifier, sanitizeDbError } from '@simplicity-admin/db';

export const load: PageServerLoad = async ({ params }) => {
	const tableName = params.table;
	const meta = await getSchemaMeta();
	const table = getTableMeta(meta, tableName);

	if (!table) {
		throw error(404, `Table "${tableName}" not found`);
	}

	return { table };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const user = requireAuth(locals.user);
		const tableName = params.table;
		const meta = await getSchemaMeta();
		const table = getTableMeta(meta, tableName);

		if (!table) {
			throw error(404, `Table "${tableName}" not found`);
		}

		const pool = getPool();
		const rbac = await getTableRbacInfo(pool, user.activeRole, table, SCHEMA);
		requireInsert(rbac);

		const formData = await request.formData();
		const dataJson = formData.get('_data');
		if (!dataJson || typeof dataJson !== 'string') {
			return { error: 'No data provided' };
		}

		const data = JSON.parse(dataJson) as Record<string, unknown>;
		const writableColumns = getWritableColumnNames(rbac);

		const columnNames: string[] = [];
		const values: unknown[] = [];

		for (const [key, value] of Object.entries(data)) {
			if (!writableColumns.has(key)) continue;
			const col = table.columns.find((c) => c.name === key);
			if (!col || col.isPrimaryKey || col.isGenerated) continue;

			// Skip empty values for columns with defaults
			if ((value === '' || value === null || value === undefined) && col.hasDefault) continue;

			columnNames.push(escapeIdentifier(key));
			values.push(value === '' ? null : value);
		}

		if (columnNames.length === 0) {
			return { error: 'No data provided' };
		}

		const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
		const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;

		try {
			await pool.query(
				`INSERT INTO ${qualifiedTable} (${columnNames.join(', ')}) VALUES (${placeholders})`,
				values,
			);
		} catch (err: unknown) {
			return { error: sanitizeDbError(err instanceof Error ? err : new Error(String(err))) };
		}

		throw redirect(303, `/${tableName}`);
	},
};
