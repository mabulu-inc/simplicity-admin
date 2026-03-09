import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';

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
	default: async ({ params, request }) => {
		const tableName = params.table;
		const meta = await getSchemaMeta();
		const table = getTableMeta(meta, tableName);

		if (!table) {
			throw error(404, `Table "${tableName}" not found`);
		}

		const formData = await request.formData();
		const dataJson = formData.get('_data');
		if (!dataJson || typeof dataJson !== 'string') {
			return { error: 'No data provided' };
		}

		const data = JSON.parse(dataJson) as Record<string, unknown>;

		// Build INSERT from submitted data, filtering to valid columns
		const validColumns = new Set(table.columns.map((c) => c.name));
		const columnNames: string[] = [];
		const values: unknown[] = [];

		for (const [key, value] of Object.entries(data)) {
			if (!validColumns.has(key)) continue;
			const col = table.columns.find((c) => c.name === key);
			if (!col || col.isPrimaryKey || col.isGenerated) continue;

			// Skip empty values for columns with defaults
			if ((value === '' || value === null || value === undefined) && col.hasDefault) continue;

			columnNames.push(`"${key}"`);
			values.push(value === '' ? null : value);
		}

		if (columnNames.length === 0) {
			return { error: 'No data provided' };
		}

		const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
		const qualifiedTable = `"${SCHEMA}"."${tableName}"`;
		const pool = getPool();

		try {
			await pool.query(
				`INSERT INTO ${qualifiedTable} (${columnNames.join(', ')}) VALUES (${placeholders})`,
				values,
			);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return { error: message };
		}

		throw redirect(303, `/${tableName}`);
	},
};
