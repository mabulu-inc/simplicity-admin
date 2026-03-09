// packages/core/tests/workflow/automations.test.ts — Event automation tests (T-065)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../src/workflow/engine.js';
import type {
	Automation,
	AutomationResult,
} from '../../src/workflow/types.js';
import type { DataEvent } from '../../src/notifications/types.js';
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

function makeOnCreateAutomation(overrides?: Partial<Automation>): Automation {
	return {
		id: 'auto-1',
		name: 'New deal email',
		enabled: true,
		trigger: { event: 'onCreate', table: 'deals' },
		conditions: [],
		actions: [
			{
				type: 'send_email',
				config: {
					subject: 'New deal created',
					body: 'A new deal was created',
					recipients: { type: 'users', userIds: ['u-notify'] },
				},
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeOnUpdateAutomation(overrides?: Partial<Automation>): Automation {
	return {
		id: 'auto-2',
		name: 'Deal won notification',
		enabled: true,
		trigger: { event: 'onUpdate', table: 'deals' },
		conditions: [{ field: 'stage', operator: 'eq', value: 'won' }],
		actions: [
			{
				type: 'update_record',
				config: { field: 'priority', value: 'high' },
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeCreateRecordAutomation(): Automation {
	return {
		id: 'auto-3',
		name: 'Create follow-up',
		enabled: true,
		trigger: { event: 'onUpdate', table: 'deals' },
		conditions: [{ field: 'stage', operator: 'eq', value: 'won' }],
		actions: [
			{
				type: 'create_record',
				config: {
					table: 'activities',
					data: { title: 'Follow up on {{name}}', deal_id: '{{id}}' },
				},
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe('WorkflowEngine — Event Automations', () => {
	let pool: ConnectionPool;
	let engine: WorkflowEngine;
	let notificationEngine: NotificationEngine;

	beforeEach(() => {
		pool = createMockPool();
		notificationEngine = createMockNotificationEngine();
		engine = new WorkflowEngine(pool, notificationEngine);
	});

	describe('processEvent()', () => {
		it('fires matching automation on onCreate (B-WF-009)', async () => {
			const automation = makeOnCreateAutomation();
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.created',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Big Deal', stage: 'new' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].automationId).toBe('auto-1');
			expect(results[0].triggered).toBe(true);
			expect(results[0].actionsExecuted).toHaveLength(1);
			expect(results[0].actionsExecuted[0].type).toBe('send_email');
			expect(results[0].actionsExecuted[0].success).toBe(true);
		});

		it('fires matching automation when conditions match (B-WF-010)', async () => {
			const automation = makeOnUpdateAutomation();
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.updated',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Big Deal', stage: 'won', priority: 'low' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(true);
			expect(results[0].actionsExecuted[0].type).toBe('update_record');
			expect(results[0].actionsExecuted[0].success).toBe(true);
		});

		it('does NOT fire when conditions do not match (B-WF-011)', async () => {
			const automation = makeOnUpdateAutomation();
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.updated',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Big Deal', stage: 'negotiation' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(false);
			expect(results[0].actionsExecuted).toHaveLength(0);
		});

		it('skips disabled automations (B-WF-015)', async () => {
			const automation = makeOnCreateAutomation({ enabled: false });
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.created',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(false);
			expect(results[0].actionsExecuted).toHaveLength(0);
		});

		it('executes create_record action (B-WF-014)', async () => {
			const automation = makeCreateRecordAutomation();
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.updated',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Big Deal', stage: 'won' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(true);
			expect(results[0].actionsExecuted[0].type).toBe('create_record');
			expect(results[0].actionsExecuted[0].success).toBe(true);

			// Verify INSERT was called
			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			expect(queryMock).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO'),
				expect.any(Array),
			);
		});

		it('records execution log entries (B-WF-016)', async () => {
			const automation = makeOnCreateAutomation();
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.created',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Test' },
				userId: 'user-1',
			};

			await engine.processEvent(event);

			// Verify execution log INSERT was called
			const queryMock = pool.query as ReturnType<typeof vi.fn>;
			const logCall = queryMock.mock.calls.find(
				(call: unknown[]) => typeof call[0] === 'string' && call[0].includes('simplicity_automation_log'),
			);
			expect(logCall).toBeDefined();
		});

		it('stops at depth 10 for loop detection (WF_004)', async () => {
			// Create an automation that triggers itself by updating the same table
			const loopingAutomation: Automation = {
				id: 'auto-loop',
				name: 'Loop automation',
				enabled: true,
				trigger: { event: 'onUpdate', table: 'deals' },
				conditions: [],
				actions: [
					{
						type: 'update_record',
						config: { field: 'counter', value: '1' },
					},
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			engine.registerAutomation(loopingAutomation);

			const event: DataEvent = {
				type: 'record.updated',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', counter: 0 },
				userId: 'user-1',
			};

			// processEvent should accept a depth parameter or track internally
			// and stop when depth >= 10
			const results = await engine.processEvent(event);

			// Should fire (depth 0 is fine) but engine should limit chained executions
			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(true);

			// Verify that if we call processEvent with depth at limit, it returns without firing
			const resultsAtLimit = await engine.processEvent(event, 10);
			expect(resultsAtLimit).toHaveLength(0);
		});

		it('does not fire automation for non-matching table', async () => {
			const automation = makeOnCreateAutomation(); // table: 'deals'
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.created',
				table: 'contacts',
				recordId: 'contact-1',
				newValues: { id: 'contact-1' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(0);
		});

		it('does not fire automation for non-matching event type', async () => {
			const automation = makeOnCreateAutomation(); // trigger: onCreate
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'record.updated',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(0);
		});

		it('fires multiple matching automations', async () => {
			engine.registerAutomation(makeOnCreateAutomation());
			engine.registerAutomation(makeOnCreateAutomation({
				id: 'auto-second',
				name: 'Second automation',
			}));

			const event: DataEvent = {
				type: 'record.created',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.triggered)).toBe(true);
		});

		it('handles onFieldChange trigger', async () => {
			const automation: Automation = {
				id: 'auto-field',
				name: 'Field change automation',
				enabled: true,
				trigger: { event: 'onFieldChange', table: 'deals', field: 'stage' },
				conditions: [],
				actions: [
					{ type: 'update_record', config: { field: 'updated_by_automation', value: 'true' } },
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			engine.registerAutomation(automation);

			const event: DataEvent = {
				type: 'field.changed',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', stage: 'won' },
				oldValues: { id: 'deal-1', stage: 'negotiation' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(1);
			expect(results[0].triggered).toBe(true);
		});

		it('skips onFieldChange when field does not match', async () => {
			const automation: Automation = {
				id: 'auto-field',
				name: 'Field change automation',
				enabled: true,
				trigger: { event: 'onFieldChange', table: 'deals', field: 'stage' },
				conditions: [],
				actions: [
					{ type: 'update_record', config: { field: 'flag', value: 'true' } },
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			engine.registerAutomation(automation);

			// field.changed but for a different field (name, not stage)
			const event: DataEvent = {
				type: 'field.changed',
				table: 'deals',
				recordId: 'deal-1',
				newValues: { id: 'deal-1', name: 'Updated Name' },
				oldValues: { id: 'deal-1', name: 'Old Name' },
				userId: 'user-1',
			};

			const results = await engine.processEvent(event);

			expect(results).toHaveLength(0);
		});
	});
});
