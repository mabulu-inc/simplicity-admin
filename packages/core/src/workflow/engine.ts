// packages/core/src/workflow/engine.ts — Workflow engine (state machine portion)

import type { ConnectionPool } from '../providers/types.js';
import type { NotificationEngine } from '../notifications/engine.js';
import type {
	StateMachine,
	Transition,
	TransitionResult,
	TransitionLogEntry,
} from './types.js';
import { evaluateGuard } from './guards.js';
import { executeHook } from './actions.js';

export class WorkflowEngine {
	private readonly pool: ConnectionPool;
	private readonly notificationEngine: NotificationEngine;
	private readonly machines = new Map<string, StateMachine>();

	constructor(pool: ConnectionPool, notificationEngine: NotificationEngine) {
		this.pool = pool;
		this.notificationEngine = notificationEngine;
	}

	/** Register a state machine for a table */
	registerStateMachine(machine: StateMachine): void {
		this.machines.set(machine.table, machine);
	}

	/** Attempt a state transition */
	async transition(
		table: string,
		recordId: string,
		toState: string,
		userId: string,
		role: string,
		comment?: string,
	): Promise<TransitionResult> {
		const machine = this.machines.get(table);
		if (!machine) {
			return { success: false, fromState: '', toState, error: 'No state machine registered for table', hooksExecuted: [] };
		}

		// Fetch current record
		const { rows } = await this.pool.query(
			`SELECT * FROM "${table}" WHERE id = $1`,
			[recordId],
		);

		if (rows.length === 0) {
			return { success: false, fromState: '', toState, error: 'Record not found', hooksExecuted: [] };
		}

		const record = rows[0] as Record<string, unknown>;
		const fromState = String(record[machine.column]);

		// Find matching transition
		const transition = machine.transitions.find(
			(t) => t.from === fromState && t.to === toState,
		);

		if (!transition) {
			return { success: false, fromState, toState, error: `Invalid state transition: ${fromState} -> ${toState}`, hooksExecuted: [] };
		}

		// Check role authorization
		if (!transition.roles.includes(role)) {
			return { success: false, fromState, toState, error: 'Insufficient permissions', hooksExecuted: [] };
		}

		// Evaluate guard condition
		if (transition.guard) {
			const guardPassed = evaluateGuard(transition.guard, record);
			if (!guardPassed) {
				return {
					success: false, fromState, toState,
					error: `Guard condition not met: ${transition.guard.condition}`,
					hooksExecuted: [],
				};
			}
		}

		// Perform state update
		await this.pool.query(
			`UPDATE "${table}" SET "${machine.column}" = $1 WHERE id = $2`,
			[toState, recordId],
		);

		// Create audit log entry
		await this.pool.query(
			`INSERT INTO "simplicity_transition_log" ("table_name", "record_id", "from_state", "to_state", "user_id", "comment") VALUES ($1, $2, $3, $4, $5, $6)`,
			[table, recordId, fromState, toState, userId, comment ?? null],
		);

		// Execute hooks (non-blocking — failures don't roll back the transition)
		const hooksExecuted: TransitionResult['hooksExecuted'] = [];
		if (transition.hooks) {
			for (const hook of transition.hooks) {
				const result = await executeHook(hook, {
					pool: this.pool,
					notificationEngine: this.notificationEngine,
					record,
					table,
					recordId,
				});
				hooksExecuted.push(result);
			}
		}

		return { success: true, fromState, toState, hooksExecuted };
	}

	/** Get available transitions for a record in its current state, filtered by role */
	async getAvailableTransitions(
		table: string,
		recordId: string,
		role: string,
	): Promise<Transition[]> {
		const machine = this.machines.get(table);
		if (!machine) return [];

		const { rows } = await this.pool.query(
			`SELECT * FROM "${table}" WHERE id = $1`,
			[recordId],
		);

		if (rows.length === 0) return [];

		const record = rows[0] as Record<string, unknown>;
		const currentState = String(record[machine.column]);

		// Check if current state is final
		const stateDef = machine.states.find((s) => s.name === currentState);
		if (stateDef?.isFinal) return [];

		return machine.transitions.filter(
			(t) => t.from === currentState && t.roles.includes(role),
		);
	}

	/** Get state transition history for a record */
	async getTransitionHistory(table: string, recordId: string): Promise<TransitionLogEntry[]> {
		const { rows } = await this.pool.query(
			`SELECT * FROM "simplicity_transition_log" WHERE "table_name" = $1 AND "record_id" = $2 ORDER BY "created_at" ASC`,
			[table, recordId],
		);

		return rows.map((row) => {
			const r = row as Record<string, unknown>;
			return {
				id: String(r.id),
				fromState: String(r.from_state),
				toState: String(r.to_state),
				userId: String(r.user_id),
				comment: r.comment ? String(r.comment) : undefined,
				timestamp: r.created_at as Date,
			};
		});
	}
}
