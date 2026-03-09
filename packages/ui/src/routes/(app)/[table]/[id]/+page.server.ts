import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';
import { getTableRbacInfo } from '$lib/server/rbac.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const tableName = params.table;
	const recordId = params.id;
	const meta = await getSchemaMeta();
	const table = getTableMeta(meta, tableName);

	if (!table) {
		throw error(404, `Table "${tableName}" not found`);
	}

	const pk = table.primaryKey[0];
	if (!pk) {
		throw error(400, `Table "${tableName}" has no primary key`);
	}

	const pool = getPool();

	// Get RBAC info for the current user's active role
	const role = locals.user?.activeRole;
	const rbac = role
		? await getTableRbacInfo(pool, role, table, SCHEMA)
		: null;

	// Use RBAC-filtered columns if available, otherwise fall back to all columns
	const columns = rbac ? rbac.visibleColumns : table.columns;
	const columnNames = columns.map((c) => `"${c.name}"`).join(', ');
	const qualifiedTable = `"${SCHEMA}"."${tableName}"`;

	const result = await pool.query(
		`SELECT ${columnNames} FROM ${qualifiedTable} WHERE "${pk}" = $1`,
		[recordId],
	);

	if (result.rows.length === 0) {
		throw error(404, 'Record not found');
	}

	return {
		table: {
			...table,
			columns,
		},
		record: result.rows[0] as Record<string, unknown>,
		readOnlyColumns: rbac?.readOnlyColumns ?? [],
		hiddenColumns: rbac?.hiddenColumns ?? [],
		canUpdate: rbac?.canUpdate ?? true,
		canDelete: rbac?.canDelete ?? true,
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const tableName = params.table;
		const recordId = params.id;
		const meta = await getSchemaMeta();
		const table = getTableMeta(meta, tableName);

		if (!table) {
			throw error(404, `Table "${tableName}" not found`);
		}

		const pk = table.primaryKey[0];
		if (!pk) {
			throw error(400, `Table "${tableName}" has no primary key`);
		}

		const formData = await request.formData();
		const dataJson = formData.get('_data');
		if (!dataJson || typeof dataJson !== 'string') {
			return { error: 'No data provided' };
		}

		const data = JSON.parse(dataJson) as Record<string, unknown>;
		const validColumns = new Set(table.columns.map((c) => c.name));

		const setClauses: string[] = [];
		const values: unknown[] = [];
		let paramIndex = 1;

		for (const [key, value] of Object.entries(data)) {
			if (!validColumns.has(key)) continue;
			const col = table.columns.find((c) => c.name === key);
			if (!col || col.isPrimaryKey || col.isGenerated) continue;

			setClauses.push(`"${key}" = $${paramIndex}`);
			values.push(value === '' ? null : value);
			paramIndex++;
		}

		if (setClauses.length === 0) {
			return { error: 'No changes to save' };
		}

		const qualifiedTable = `"${SCHEMA}"."${tableName}"`;
		const pool = getPool();

		try {
			values.push(recordId);
			await pool.query(
				`UPDATE ${qualifiedTable} SET ${setClauses.join(', ')} WHERE "${pk}" = $${paramIndex}`,
				values,
			);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return { error: message };
		}

		throw redirect(303, `/${tableName}`);
	},

	delete: async ({ params }) => {
		const tableName = params.table;
		const recordId = params.id;
		const meta = await getSchemaMeta();
		const table = getTableMeta(meta, tableName);

		if (!table) {
			throw error(404, `Table "${tableName}" not found`);
		}

		const pk = table.primaryKey[0];
		if (!pk) {
			throw error(400, `Table "${tableName}" has no primary key`);
		}

		const qualifiedTable = `"${SCHEMA}"."${tableName}"`;
		const pool = getPool();

		try {
			await pool.query(`DELETE FROM ${qualifiedTable} WHERE "${pk}" = $1`, [recordId]);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			if (message.includes('violates foreign key constraint')) {
				return { error: 'Cannot delete: this record is referenced by other records' };
			}
			return { error: message };
		}

		throw redirect(303, `/${tableName}`);
	},
};
