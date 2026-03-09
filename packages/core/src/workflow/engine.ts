// packages/core/src/workflow/engine.ts — Workflow engine (state machines + event automations)

import type { ConnectionPool } from '../providers/types.js';
import type { NotificationEngine } from '../notifications/engine.js';
import type { DataEvent } from '../notifications/types.js';
import type {
	Automation,
	AutomationResult,
	StateMachine,
	Transition,
	TransitionResult,
	TransitionLogEntry,
} from './types.js';
import { evaluateGuard, evaluateConditions } from './guards.js';
import { executeHook, executeAction } from './actions.js';

/** Map DataEvent.type to AutomationTrigger.event */
const EVENT_TYPE_MAP: Record<string, string> = {
	'record.created': 'onCreate',
	'record.updated': 'onUpdate',
	'record.deleted': 'onDelete',
	'field.changed': 'onFieldChange',
	'schedule': 'onSchedule',
};

/** Maximum automation chain depth to prevent infinite loops (WF_004) */
const MAX_AUTOMATION_DEPTH = 10;

export class WorkflowEngine {
	private readonly pool: ConnectionPool;
	private readonly notificationEngine: NotificationEngine;
	private readonly machines = new Map<string, StateMachine>();
	private readonly automations: Automation[] = [];

	constructor(pool: ConnectionPool, notificationEngine: NotificationEngine) {
		this.pool = pool;
		this.notificationEngine = notificationEngine;
	}

	/** Register a state machine for a table */
	registerStateMachine(machine: StateMachine): void {
		this.machines.set(machine.table, machine);
	}

	/** Register an automation */
	registerAutomation(automation: Automation): void {
		this.automations.push(automation);
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

	/** Process a data event against registered automations */
	async processEvent(event: DataEvent, depth = 0): Promise<AutomationResult[]> {
		// Loop detection: stop at maximum depth (WF_004)
		if (depth >= MAX_AUTOMATION_DEPTH) {
			return [];
		}

		const mappedEvent = EVENT_TYPE_MAP[event.type];
		if (!mappedEvent) return [];

		// Filter automations that match the event type and table
		const matching = this.automations.filter((a) => {
			if (a.trigger.event !== mappedEvent) return false;
			if (a.trigger.table && a.trigger.table !== event.table) return false;
			// For onFieldChange, verify the trigger field was actually changed
			if (a.trigger.event === 'onFieldChange' && a.trigger.field) {
				if (!event.oldValues || !event.newValues) return false;
				if (!(a.trigger.field in event.newValues)) return false;
			}
			return true;
		});

		const results: AutomationResult[] = [];

		for (const automation of matching) {
			const result: AutomationResult = {
				automationId: automation.id,
				automationName: automation.name,
				triggered: false,
				actionsExecuted: [],
			};

			// Skip disabled automations
			if (!automation.enabled) {
				results.push(result);
				continue;
			}

			// Evaluate conditions against newValues (or oldValues for onDelete)
			const record = event.newValues ?? event.oldValues ?? {};
			if (automation.conditions.length > 0 && !evaluateConditions(automation.conditions, record)) {
				results.push(result);
				continue;
			}

			// All conditions passed — fire the automation
			result.triggered = true;
			const startTime = Date.now();

			for (const action of automation.actions) {
				const actionResult = await executeAction(action, {
					pool: this.pool,
					notificationEngine: this.notificationEngine,
					record,
					table: event.table,
					recordId: event.recordId,
					tenantId: event.tenantId,
				});
				result.actionsExecuted.push(actionResult);
			}

			const durationMs = Date.now() - startTime;

			// Record execution log
			await this.logAutomationExecution(automation, result, durationMs);

			results.push(result);
		}

		return results;
	}

	/** Write an execution log entry for an automation run */
	private async logAutomationExecution(
		automation: Automation,
		result: AutomationResult,
		durationMs: number,
	): Promise<void> {
		try {
			const status = result.actionsExecuted.every((a) => a.success) ? 'success' : 'partial_failure';
			const errors = result.actionsExecuted
				.filter((a) => !a.success && a.error)
				.map((a) => a.error);

			await this.pool.query(
				`INSERT INTO "simplicity_automation_log" ("automation_id", "automation_name", "status", "duration_ms", "errors")
				 VALUES ($1, $2, $3, $4, $5)`,
				[automation.id, automation.name, status, durationMs, errors.length > 0 ? JSON.stringify(errors) : null],
			);
		} catch {
			// Logging failures are non-blocking
		}
	}
}
