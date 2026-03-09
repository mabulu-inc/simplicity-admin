import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	executeHook,
	executeAction,
} from '../../src/workflow/actions.js';
import type {
	TransitionHook,
	AutomationAction,
	NotificationHookConfig,
	WebhookHookConfig,
	UpdateFieldHookConfig,
} from '../../src/workflow/types.js';
import type { ConnectionPool, QueryResult } from '../../src/providers/types.js';
import type { NotificationEngine } from '../../src/notifications/engine.js';

// ── Test helpers ─────────────────────────────────────────────────────

function createMockPool(overrides?: Partial<ConnectionPool>): ConnectionPool {
	return {
		query: vi.fn<(sql: string, params?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>>()
			.mockResolvedValue({ rows: [{ id: 'new-1' }], rowCount: 1 }),
		withClient: vi.fn(),
		end: vi.fn(),
		...overrides,
	};
}

function createMockNotificationEngine(): NotificationEngine {
	return {
		send: vi.fn().mockResolvedValue({ id: 'notif-1', userId: 'u1', channel: 'in_app', subject: '', body: '', read: false, ruleId: '', createdAt: new Date() }),
		processEvent: vi.fn(),
		getUnread: vi.fn(),
		markRead: vi.fn(),
		markAllRead: vi.fn(),
	} as unknown as NotificationEngine;
}

interface ActionContext {
	pool: ConnectionPool;
	notificationEngine: NotificationEngine;
	record: Record<string, unknown>;
	table: string;
	recordId: string;
	tenantId?: string;
}

function createCtx(overrides?: Partial<ActionContext>): ActionContext {
	return {
		pool: createMockPool(),
		notificationEngine: createMockNotificationEngine(),
		record: { id: 'rec-1', name: 'Test Deal', value: 5000 },
		table: 'deals',
		recordId: 'rec-1',
		...overrides,
	};
}

// ── TransitionHook executors ─────────────────────────────────────────

describe('executeHook — notification', () => {
	it('sends notification via engine', async () => {
		const ctx = createCtx();
		const hook: TransitionHook = {
			type: 'notification',
			config: {
				template: { subject: 'Deal {{name}} updated', body: 'Value is {{value}}' },
				recipients: { type: 'users', userIds: ['user-1', 'user-2'] },
			} satisfies NotificationHookConfig,
		};

		const result = await executeHook(hook, ctx);

		expect(result.type).toBe('notification');
		expect(result.success).toBe(true);
		const engine = ctx.notificationEngine;
		expect(engine.send).toHaveBeenCalledTimes(2);
	});

	it('interpolates template fields', async () => {
		const ctx = createCtx({ record: { id: 'r1', name: 'Big Deal', value: 9999 } });
		const hook: TransitionHook = {
			type: 'notification',
			config: {
				template: { subject: 'Updated: {{name}}', body: 'Worth {{value}}' },
				recipients: { type: 'users', userIds: ['u1'] },
			} satisfies NotificationHookConfig,
		};

		await executeHook(hook, ctx);

		const engine = ctx.notificationEngine;
		expect(engine.send).toHaveBeenCalledWith(
			expect.objectContaining({
				subject: 'Updated: Big Deal',
				body: 'Worth 9999',
			}),
		);
	});
});

describe('executeHook — webhook', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
	});

	it('sends HTTP POST to configured URL', async () => {
		const ctx = createCtx();
		const hook: TransitionHook = {
			type: 'webhook',
			config: {
				url: 'https://example.com/hook',
				method: 'POST',
				headers: { 'X-Custom': 'test' },
			} satisfies WebhookHookConfig,
		};

		const result = await executeHook(hook, ctx);

		expect(result.type).toBe('webhook');
		expect(result.success).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://example.com/hook',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ 'X-Custom': 'test' }),
			}),
		);
	});

	it('interpolates body template', async () => {
		const ctx = createCtx({ record: { id: 'r1', name: 'Acme' } });
		const hook: TransitionHook = {
			type: 'webhook',
			config: {
				url: 'https://example.com/hook',
				method: 'POST',
				bodyTemplate: '{"deal":"{{name}}"}',
			} satisfies WebhookHookConfig,
		};

		await executeHook(hook, ctx);

		expect(fetch).toHaveBeenCalledWith(
			'https://example.com/hook',
			expect.objectContaining({
				body: '{"deal":"Acme"}',
			}),
		);
	});

	it('returns failure on HTTP error (non-blocking)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }));

		const ctx = createCtx();
		const hook: TransitionHook = {
			type: 'webhook',
			config: {
				url: 'https://example.com/hook',
				method: 'POST',
			} satisfies WebhookHookConfig,
		};

		const result = await executeHook(hook, ctx);

		expect(result.type).toBe('webhook');
		expect(result.success).toBe(false);
		expect(result.error).toContain('500');
	});

	it('returns failure on network error (non-blocking)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

		const ctx = createCtx();
		const hook: TransitionHook = {
			type: 'webhook',
			config: {
				url: 'https://example.com/hook',
				method: 'POST',
			} satisfies WebhookHookConfig,
		};

		const result = await executeHook(hook, ctx);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Connection refused');
	});
});

describe('executeHook — update_field', () => {
	it('updates field on the record via SQL', async () => {
		const pool = createMockPool();
		const ctx = createCtx({ pool });
		const hook: TransitionHook = {
			type: 'update_field',
			config: {
				field: 'priority',
				value: 'high',
			} satisfies UpdateFieldHookConfig,
		};

		const result = await executeHook(hook, ctx);

		expect(result.type).toBe('update_field');
		expect(result.success).toBe(true);
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining('UPDATE'),
			expect.arrayContaining(['high', 'rec-1']),
		);
	});

	it('interpolates value template', async () => {
		const pool = createMockPool();
		const ctx = createCtx({ pool, record: { id: 'r1', owner: 'admin-1' }, recordId: 'r1' });
		const hook: TransitionHook = {
			type: 'update_field',
			config: {
				field: 'assigned_to',
				value: '{{owner}}',
			} satisfies UpdateFieldHookConfig,
		};

		await executeHook(hook, ctx);

		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining('UPDATE'),
			expect.arrayContaining(['admin-1', 'r1']),
		);
	});
});

// ── AutomationAction executors ──────────────────────────────────────

describe('executeAction — send_email (notification)', () => {
	it('sends notification via engine', async () => {
		const ctx = createCtx();
		const action: AutomationAction = {
			type: 'send_email',
			config: {
				subject: 'New deal: {{name}}',
				body: 'A deal worth {{value}} was created',
				recipients: { type: 'users', userIds: ['u1'] },
			},
		};

		const result = await executeAction(action, ctx);

		expect(result.type).toBe('send_email');
		expect(result.success).toBe(true);
		expect(ctx.notificationEngine.send).toHaveBeenCalled();
	});
});

describe('executeAction — call_webhook', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
	});

	it('sends HTTP POST with record data', async () => {
		const ctx = createCtx();
		const action: AutomationAction = {
			type: 'call_webhook',
			config: {
				url: 'https://example.com/automation',
				method: 'POST',
			},
		};

		const result = await executeAction(action, ctx);

		expect(result.type).toBe('call_webhook');
		expect(result.success).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://example.com/automation',
			expect.objectContaining({ method: 'POST' }),
		);
	});
});

describe('executeAction — update_record', () => {
	it('modifies record field in database', async () => {
		const pool = createMockPool();
		const ctx = createCtx({ pool });
		const action: AutomationAction = {
			type: 'update_record',
			config: {
				field: 'priority',
				value: 'high',
			},
		};

		const result = await executeAction(action, ctx);

		expect(result.type).toBe('update_record');
		expect(result.success).toBe(true);
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining('UPDATE'),
			expect.arrayContaining(['high', 'rec-1']),
		);
	});
});

describe('executeAction — create_record', () => {
	it('inserts a new record into the specified table', async () => {
		const pool = createMockPool();
		const ctx = createCtx({ pool });
		const action: AutomationAction = {
			type: 'create_record',
			config: {
				table: 'activities',
				data: { type: 'follow_up', deal_id: '{{id}}', note: 'Follow up on {{name}}' },
			},
		};

		const result = await executeAction(action, ctx);

		expect(result.type).toBe('create_record');
		expect(result.success).toBe(true);
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO'),
			expect.any(Array),
		);
	});

	it('interpolates template values in data fields', async () => {
		const pool = createMockPool();
		const ctx = createCtx({ pool, record: { id: 'deal-1', name: 'Acme Corp' } });
		const action: AutomationAction = {
			type: 'create_record',
			config: {
				table: 'activities',
				data: { deal_id: '{{id}}', note: 'Follow up: {{name}}' },
			},
		};

		await executeAction(action, ctx);

		// Verify interpolated values were passed
		const callArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
		const params = callArgs[1] as unknown[];
		expect(params).toContain('deal-1');
		expect(params).toContain('Follow up: Acme Corp');
	});
});

describe('executeAction — failed action is non-blocking', () => {
	it('returns error result instead of throwing', async () => {
		const pool = createMockPool({
			query: vi.fn().mockRejectedValue(new Error('DB connection lost')),
		});
		const ctx = createCtx({ pool });
		const action: AutomationAction = {
			type: 'update_record',
			config: { field: 'status', value: 'done' },
		};

		const result = await executeAction(action, ctx);

		expect(result.success).toBe(false);
		expect(result.error).toContain('DB connection lost');
	});
});
