import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/workflow/engine.js';
import type {
	StateMachine,
	TransitionResult,
	TransitionLogEntry,
} from '../../src/workflow/types.js';
import type { ConnectionPool, QueryResult } from '../../src/providers/types.js';
import type { NotificationEngine } from '../../src/notifications/engine.js';

// ── Test helpers ─────────────────────────────────────────────────────

function createMockPool(overrides?: Partial<ConnectionPool>): ConnectionPool {
	return {
		query: vi.fn<(sql: string, params?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>>()
			.mockResolvedValue({ rows: [], rowCount: 0 }),
		withClient: vi.fn(),
		end: vi.fn(),
		...overrides,
	};
}

function createMockNotificationEngine(): NotificationEngine {
	return {
		send: vi.fn().mockResolvedValue({
			id: 'notif-1', userId: 'u1', channel: 'in_app',
			subject: '', body: '', read: false, ruleId: '', createdAt: new Date(),
		}),
		processEvent: vi.fn(),
		getUnread: vi.fn(),
		markRead: vi.fn(),
		markAllRead: vi.fn(),
	} as unknown as NotificationEngine;
}

function createDealsMachine(): StateMachine {
	return {
		id: 'sm-deals',
		table: 'deals',
		column: 'status',
		states: [
			{ name: 'draft', label: 'Draft' },
			{ name: 'review', label: 'Review', color: 'yellow' },
			{ name: 'approved', label: 'Approved', color: 'green' },
			{ name: 'archived', label: 'Archived', isFinal: true },
		],
		transitions: [
			{ from: 'draft', to: 'review', label: 'Submit for Review', roles: ['app_editor', 'app_admin'] },
			{ from: 'review', to: 'approved', label: 'Approve', roles: ['app_admin'] },
			{ from: 'review', to: 'draft', label: 'Send Back', roles: ['app_editor', 'app_admin'] },
			{ from: 'approved', to: 'archived', label: 'Archive', roles: ['app_admin'] },
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function createGuardedMachine(): StateMachine {
	return {
		id: 'sm-guarded',
		table: 'deals',
		column: 'status',
		states: [
			{ name: 'draft', label: 'Draft' },
			{ name: 'review', label: 'Review' },
		],
		transitions: [
			{
				from: 'draft', to: 'review', label: 'Submit',
				roles: ['app_editor'],
				guard: { condition: 'value > 1000' },
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function createHookedMachine(): StateMachine {
	return {
		id: 'sm-hooked',
		table: 'deals',
		column: 'status',
		states: [
			{ name: 'draft', label: 'Draft' },
			{ name: 'review', label: 'Review' },
		],
		transitions: [
			{
				from: 'draft', to: 'review', label: 'Submit',
				roles: ['app_editor'],
				hooks: [
					{
						type: 'notification',
						config: {
							template: { subject: 'Deal submitted', body: 'Deal {{name}} submitted for review' },
							recipients: { type: 'users', userIds: ['u-reviewer'] },
						},
					},
				],
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe('WorkflowEngine', () => {
	let pool: ConnectionPool;
	let engine: WorkflowEngine;
	let notificationEngine: NotificationEngine;

	beforeEach(() => {
		pool = createMockPool();
		notificationEngine = createMockNotificationEngine();
		engine = new WorkflowEngine(pool, notificationEngine);
	});

	describe('transition()', () => {
		it('updates record state on valid transition (B-WF-001)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			// Mock: fetch current record state
			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock
				// First call: fetch current record
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft' }], rowCount: 1 })
				// Second call: UPDATE state
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'review' }], rowCount: 1 })
				// Third call: INSERT transition log
				.mockResolvedValueOnce({ rows: [{ id: 'log-1' }], rowCount: 1 });

			const result = await engine.transition('deals', 'deal-1', 'review', 'user-1', 'app_editor');

			expect(result.success).toBe(true);
			expect(result.fromState).toBe('draft');
			expect(result.toState).toBe('review');
			expect(result.error).toBeUndefined();

			// Verify UPDATE was called
			expect(queryMock).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE'),
				expect.arrayContaining(['review', 'deal-1']),
			);
		});

		it('rejects unauthorized role (B-WF-002)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft' }], rowCount: 1 });

			const result = await engine.transition('deals', 'deal-1', 'review', 'user-1', 'app_viewer');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Insufficient permissions');
		});

		it('rejects failed guard (B-WF-003)', async () => {
			const machine = createGuardedMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft', value: 500 }], rowCount: 1 });

			const result = await engine.transition('deals', 'deal-1', 'review', 'user-1', 'app_editor');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Guard condition not met');
			expect(result.error).toContain('value > 1000');
		});

		it('executes hooks on successful transition (B-WF-004)', async () => {
			const machine = createHookedMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft', name: 'Big Deal' }], rowCount: 1 })
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'review' }], rowCount: 1 })
				.mockResolvedValueOnce({ rows: [{ id: 'log-1' }], rowCount: 1 });

			const result = await engine.transition('deals', 'deal-1', 'review', 'user-1', 'app_editor');

			expect(result.success).toBe(true);
			expect(result.hooksExecuted).toHaveLength(1);
			expect(result.hooksExecuted[0].type).toBe('notification');
			expect(result.hooksExecuted[0].success).toBe(true);

			// Verify notification was sent
			expect(notificationEngine.send).toHaveBeenCalled();
		});

		it('creates audit log entry on transition (B-WF-008)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft' }], rowCount: 1 })
				.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'review' }], rowCount: 1 })
				.mockResolvedValueOnce({ rows: [{ id: 'log-1' }], rowCount: 1 });

			await engine.transition('deals', 'deal-1', 'review', 'user-1', 'app_editor', 'Submitting for review');

			// Verify INSERT into transition log
			expect(queryMock).toHaveBeenCalledWith(
				expect.stringContaining('INSERT'),
				expect.arrayContaining(['draft', 'review', 'user-1', 'Submitting for review']),
			);
		});

		it('returns error when no state machine registered for table', async () => {
			const result = await engine.transition('unknown_table', 'rec-1', 'active', 'user-1', 'app_admin');

			expect(result.success).toBe(false);
			expect(result.error).toContain('No state machine');
		});

		it('returns error when record not found', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

			const result = await engine.transition('deals', 'nonexistent', 'review', 'user-1', 'app_editor');

			expect(result.success).toBe(false);
			expect(result.error).toContain('not found');
		});

		it('returns error when no valid transition exists from current state', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'draft' }], rowCount: 1 });

			const result = await engine.transition('deals', 'deal-1', 'archived', 'user-1', 'app_admin');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid state transition');
		});
	});

	describe('getAvailableTransitions()', () => {
		it('filters transitions by role (B-WF-006)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'review' }], rowCount: 1 });

			const transitions = await engine.getAvailableTransitions('deals', 'deal-1', 'app_editor');

			// app_editor can only do review->draft, not review->approved
			expect(transitions).toHaveLength(1);
			expect(transitions[0].from).toBe('review');
			expect(transitions[0].to).toBe('draft');
		});

		it('returns empty array for final state (B-WF-007)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [{ id: 'deal-1', status: 'archived' }], rowCount: 1 });

			const transitions = await engine.getAvailableTransitions('deals', 'deal-1', 'app_admin');

			expect(transitions).toHaveLength(0);
		});

		it('returns empty array when no state machine registered', async () => {
			const transitions = await engine.getAvailableTransitions('unknown', 'rec-1', 'app_admin');
			expect(transitions).toHaveLength(0);
		});
	});

	describe('getTransitionHistory()', () => {
		it('returns chronological log (B-WF-008)', async () => {
			const machine = createDealsMachine();
			engine.registerStateMachine(machine);

			const now = new Date();
			const earlier = new Date(now.getTime() - 60_000);

			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({
				rows: [
					{ id: 'log-1', from_state: 'draft', to_state: 'review', user_id: 'u1', comment: null, created_at: earlier },
					{ id: 'log-2', from_state: 'review', to_state: 'approved', user_id: 'u2', comment: 'LGTM', created_at: now },
				],
				rowCount: 2,
			});

			const history = await engine.getTransitionHistory('deals', 'deal-1');

			expect(history).toHaveLength(2);
			expect(history[0].fromState).toBe('draft');
			expect(history[0].toState).toBe('review');
			expect(history[1].fromState).toBe('review');
			expect(history[1].toState).toBe('approved');
			expect(history[1].comment).toBe('LGTM');
		});

		it('returns empty array when no history', async () => {
			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

			const history = await engine.getTransitionHistory('deals', 'deal-1');
			expect(history).toHaveLength(0);
		});
	});
});
