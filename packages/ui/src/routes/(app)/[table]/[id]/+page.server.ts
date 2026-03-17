import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSchemaMeta, getTableMeta, getPool, SCHEMA } from '$lib/server/db.js';
import { getTableRbacInfo } from '$lib/server/rbac.js';
import { requireAuth, requireUpdate, requireDelete, getWritableColumnNames } from '$lib/server/rbac-guards.js';
import { getStateMachine } from '@mabulu-inc/simplicity-admin-core';
import { escapeIdentifier, sanitizeDbError } from '@mabulu-inc/simplicity-admin-db';

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
	const columnNames = columns.map((c) => escapeIdentifier(c.name)).join(', ');
	const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;

	const result = await pool.query(
		`SELECT ${columnNames} FROM ${qualifiedTable} WHERE ${escapeIdentifier(pk)} = $1`,
		[recordId],
	);

	if (result.rows.length === 0) {
		throw error(404, 'Record not found');
	}

	// Load workflow state machine for this table (if one exists)
	let workflow: {
		states: { name: string; label: string; color?: string; isFinal?: boolean }[];
		transitions: { from: string; to: string; label: string; roles: string[] }[];
		column: string;
	} | null = null;

	try {
		const machine = await getStateMachine(pool, tableName);
		if (machine) {
			const record = result.rows[0] as Record<string, unknown>;
			const currentState = record[machine.column] as string | undefined;
			// Filter transitions to those available from current state and for user's role
			const available = currentState
				? machine.transitions.filter(
						(t) =>
							t.from === currentState &&
							(!role || t.roles.length === 0 || t.roles.includes(role)),
					)
				: [];
			// Check if current state is final
			const currentStateDef = machine.states.find((s) => s.name === currentState);
			workflow = {
				states: machine.states,
				transitions: currentStateDef?.isFinal ? [] : available.map((t) => ({
					from: t.from,
					to: t.to,
					label: t.label,
					roles: t.roles,
				})),
				column: machine.column,
			};
		}
	} catch {
		// Workflow table may not exist yet — ignore
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
		workflow,
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const user = requireAuth(locals.user);
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
		const rbac = await getTableRbacInfo(pool, user.activeRole, table, SCHEMA);
		requireUpdate(rbac);

		const formData = await request.formData();
		const dataJson = formData.get('_data');
		if (!dataJson || typeof dataJson !== 'string') {
			return { error: 'No data provided' };
		}

		const data = JSON.parse(dataJson) as Record<string, unknown>;
		const writableColumns = getWritableColumnNames(rbac);

		const setClauses: string[] = [];
		const values: unknown[] = [];
		let paramIndex = 1;

		for (const [key, value] of Object.entries(data)) {
			if (!writableColumns.has(key)) continue;
			const col = table.columns.find((c) => c.name === key);
			if (!col || col.isPrimaryKey || col.isGenerated) continue;

			setClauses.push(`${escapeIdentifier(key)} = $${paramIndex}`);
			values.push(value === '' ? null : value);
			paramIndex++;
		}

		if (setClauses.length === 0) {
			return { error: 'No changes to save' };
		}

		const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;

		try {
			values.push(recordId);
			await pool.query(
				`UPDATE ${qualifiedTable} SET ${setClauses.join(', ')} WHERE ${escapeIdentifier(pk)} = $${paramIndex}`,
				values,
			);
		} catch (err: unknown) {
			return { error: sanitizeDbError(err instanceof Error ? err : new Error(String(err))) };
		}

		throw redirect(303, `/${tableName}`);
	},

	transition: async ({ params, request, locals }) => {
		const user = requireAuth(locals.user);
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
		const toState = formData.get('toState');
		if (!toState || typeof toState !== 'string') {
			return { error: 'No target state provided' };
		}

		const pool = getPool();

		try {
			const machine = await getStateMachine(pool, tableName);
			if (!machine) {
				return { error: 'No state machine configured for this table' };
			}

			// Fetch current record state
			const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;
			const result = await pool.query(
				`SELECT ${escapeIdentifier(machine.column)} FROM ${qualifiedTable} WHERE ${escapeIdentifier(pk)} = $1`,
				[recordId],
			);

			if (result.rows.length === 0) {
				return { error: 'Record not found' };
			}

			const record = result.rows[0] as Record<string, unknown>;
			const currentState = record[machine.column] as string;

			// Validate transition exists and role is authorized
			const role = user.activeRole;
			const transition = machine.transitions.find(
				(t) =>
					t.from === currentState &&
					t.to === toState &&
					(t.roles.length === 0 || t.roles.includes(role)),
			);

			if (!transition) {
				return { error: 'Transition not allowed' };
			}

			// Execute the state change
			await pool.query(
				`UPDATE ${qualifiedTable} SET ${escapeIdentifier(machine.column)} = $1 WHERE ${escapeIdentifier(pk)} = $2`,
				[toState, recordId],
			);

			// Write to audit log
			const userId = user.userId ?? null;
			await pool.query(
				`INSERT INTO public.simplicity_transition_log (table_name, record_id, from_state, to_state, user_id)
				 VALUES ($1, $2, $3, $4, $5)`,
				[tableName, recordId, currentState, toState, userId],
			);
		} catch (err: unknown) {
			return { error: sanitizeDbError(err instanceof Error ? err : new Error(String(err))) };
		}

		throw redirect(303, `/${tableName}/${recordId}`);
	},

	delete: async ({ params, locals }) => {
		const user = requireAuth(locals.user);
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
		const rbac = await getTableRbacInfo(pool, user.activeRole, table, SCHEMA);
		requireDelete(rbac);

		const qualifiedTable = `${escapeIdentifier(SCHEMA)}.${escapeIdentifier(tableName)}`;

		try {
			await pool.query(`DELETE FROM ${qualifiedTable} WHERE ${escapeIdentifier(pk)} = $1`, [recordId]);
		} catch (err: unknown) {
			return { error: sanitizeDbError(err instanceof Error ? err : new Error(String(err))) };
		}

		throw redirect(303, `/${tableName}`);
	},
};
