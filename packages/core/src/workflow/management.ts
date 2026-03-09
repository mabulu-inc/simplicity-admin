// packages/core/src/workflow/management.ts — CRUD for state machines and automations

import type { ConnectionPool } from '../providers/types.js';
import type { StateMachine, Automation } from './types.js';

// ── State Machine CRUD ──────────────────────────────────────────────

export async function createStateMachine(
	pool: ConnectionPool,
	machine: Omit<StateMachine, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<StateMachine> {
	const { rows } = await pool.query(
		`INSERT INTO "simplicity_state_machines" ("table_name", "column_name", "states", "transitions")
		 VALUES ($1, $2, $3, $4)
		 RETURNING *`,
		[machine.table, machine.column, JSON.stringify(machine.states), JSON.stringify(machine.transitions)],
	);
	return rowToStateMachine(rows[0] as Record<string, unknown>);
}

export async function updateStateMachine(
	pool: ConnectionPool,
	id: string,
	updates: Partial<StateMachine>,
): Promise<StateMachine> {
	const sets: string[] = [];
	const params: unknown[] = [];
	let idx = 1;

	if (updates.table !== undefined) { sets.push(`"table_name" = $${idx++}`); params.push(updates.table); }
	if (updates.column !== undefined) { sets.push(`"column_name" = $${idx++}`); params.push(updates.column); }
	if (updates.states !== undefined) { sets.push(`"states" = $${idx++}`); params.push(JSON.stringify(updates.states)); }
	if (updates.transitions !== undefined) { sets.push(`"transitions" = $${idx++}`); params.push(JSON.stringify(updates.transitions)); }

	sets.push(`"updated_at" = NOW()`);
	params.push(id);

	const { rows } = await pool.query(
		`UPDATE "simplicity_state_machines" SET ${sets.join(', ')} WHERE "id" = $${idx} RETURNING *`,
		params,
	);
	return rowToStateMachine(rows[0] as Record<string, unknown>);
}

export async function deleteStateMachine(pool: ConnectionPool, id: string): Promise<void> {
	await pool.query(`DELETE FROM "simplicity_state_machines" WHERE "id" = $1`, [id]);
}

export async function getStateMachine(pool: ConnectionPool, table: string): Promise<StateMachine | null> {
	const { rows } = await pool.query(
		`SELECT * FROM "simplicity_state_machines" WHERE "table_name" = $1`,
		[table],
	);
	if (rows.length === 0) return null;
	return rowToStateMachine(rows[0] as Record<string, unknown>);
}

export async function listStateMachines(pool: ConnectionPool): Promise<StateMachine[]> {
	const { rows } = await pool.query(`SELECT * FROM "simplicity_state_machines" ORDER BY "created_at" ASC`);
	return rows.map((row) => rowToStateMachine(row as Record<string, unknown>));
}

// ── Automation CRUD ─────────────────────────────────────────────────

export async function createAutomation(
	pool: ConnectionPool,
	automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Automation> {
	const { rows } = await pool.query(
		`INSERT INTO "simplicity_automations" ("name", "enabled", "trigger", "conditions", "actions")
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING *`,
		[automation.name, automation.enabled, JSON.stringify(automation.trigger), JSON.stringify(automation.conditions), JSON.stringify(automation.actions)],
	);
	return rowToAutomation(rows[0] as Record<string, unknown>);
}

export async function updateAutomation(
	pool: ConnectionPool,
	id: string,
	updates: Partial<Automation>,
): Promise<Automation> {
	const sets: string[] = [];
	const params: unknown[] = [];
	let idx = 1;

	if (updates.name !== undefined) { sets.push(`"name" = $${idx++}`); params.push(updates.name); }
	if (updates.enabled !== undefined) { sets.push(`"enabled" = $${idx++}`); params.push(updates.enabled); }
	if (updates.trigger !== undefined) { sets.push(`"trigger" = $${idx++}`); params.push(JSON.stringify(updates.trigger)); }
	if (updates.conditions !== undefined) { sets.push(`"conditions" = $${idx++}`); params.push(JSON.stringify(updates.conditions)); }
	if (updates.actions !== undefined) { sets.push(`"actions" = $${idx++}`); params.push(JSON.stringify(updates.actions)); }

	sets.push(`"updated_at" = NOW()`);
	params.push(id);

	const { rows } = await pool.query(
		`UPDATE "simplicity_automations" SET ${sets.join(', ')} WHERE "id" = $${idx} RETURNING *`,
		params,
	);
	return rowToAutomation(rows[0] as Record<string, unknown>);
}

export async function deleteAutomation(pool: ConnectionPool, id: string): Promise<void> {
	await pool.query(`DELETE FROM "simplicity_automations" WHERE "id" = $1`, [id]);
}

export async function listAutomations(pool: ConnectionPool): Promise<Automation[]> {
	const { rows } = await pool.query(`SELECT * FROM "simplicity_automations" ORDER BY "created_at" ASC`);
	return rows.map((row) => rowToAutomation(row as Record<string, unknown>));
}

// ── Row Mappers ─────────────────────────────────────────────────────

function rowToStateMachine(row: Record<string, unknown>): StateMachine {
	return {
		id: String(row.id),
		table: String(row.table_name),
		column: String(row.column_name),
		states: parseJson(row.states),
		transitions: parseJson(row.transitions),
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
	};
}

function rowToAutomation(row: Record<string, unknown>): Automation {
	return {
		id: String(row.id),
		name: String(row.name),
		enabled: Boolean(row.enabled),
		trigger: parseJson(row.trigger),
		conditions: parseJson(row.conditions),
		actions: parseJson(row.actions),
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(value: unknown): any {
	if (typeof value === 'string') return JSON.parse(value) as unknown;
	return value;
}
