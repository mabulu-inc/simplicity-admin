import { describe, it, expect, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { z } from 'zod';

// Build the schemas inline for the mock — same schemas as in core/src/workflow/schemas.ts
const automationConditionSchema = z.object({
	field: z.string(),
	operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
	value: z.unknown(),
});
const automationActionSchema = z.object({
	type: z.enum(['send_email', 'call_webhook', 'update_record', 'create_record']),
	config: z.record(z.string(), z.unknown()),
});
const transitionSchema = z.object({
	from: z.string(),
	to: z.string(),
	label: z.string(),
	roles: z.array(z.string()),
	guard: z.object({ condition: z.string() }).optional(),
	hooks: z
		.array(z.object({ type: z.enum(['notification', 'webhook', 'update_field']), config: z.record(z.string(), z.unknown()) }))
		.optional(),
});

const automationConditionsSchema = z.array(automationConditionSchema);
const automationActionsSchema = z.array(automationActionSchema);
const transitionsSchema = z.array(transitionSchema);

vi.mock('$lib/server/db.js', () => ({
	getPool: () => ({}),
}));

vi.mock('@mabulu-inc/simplicity-admin-core', () => ({
	createAutomation: vi.fn().mockResolvedValue({ id: '1' }),
	createStateMachine: vi.fn().mockResolvedValue({ id: '1' }),
	automationConditionsSchema,
	automationActionsSchema,
	transitionsSchema,
}));

function makeFormData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) {
		fd.set(k, v);
	}
	return fd;
}

function makeRequest(fd: FormData): Request {
	return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const adminLocals = {
	user: { userId: '1', roles: ['app_admin'], activeRole: 'app_admin', superAdmin: false },
};

describe('Automations form action validation', () => {
	it('returns 400 for malformed conditions JSON', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/automations/+page.server.js'
		);
		const fd = makeFormData({
			name: 'Test',
			triggerEvent: 'onCreate',
			conditions: '{not valid json',
		});

		try {
			await actions.create({ request: makeRequest(fd), locals: adminLocals } as never);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) {
				expect(e.status).toBe(400);
			}
		}
	});

	it('returns 400 for structurally invalid conditions', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/automations/+page.server.js'
		);
		const fd = makeFormData({
			name: 'Test',
			triggerEvent: 'onCreate',
			conditions: JSON.stringify([{ field: 'x', operator: 'INVALID', value: 1 }]),
		});

		try {
			await actions.create({ request: makeRequest(fd), locals: adminLocals } as never);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) {
				expect(e.status).toBe(400);
			}
		}
	});

	it('returns 400 for structurally invalid actions', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/automations/+page.server.js'
		);
		const fd = makeFormData({
			name: 'Test',
			triggerEvent: 'onCreate',
			conditions: '[]',
			actions: JSON.stringify([{ type: 'destroy_all', config: {} }]),
		});

		try {
			await actions.create({ request: makeRequest(fd), locals: adminLocals } as never);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) {
				expect(e.status).toBe(400);
			}
		}
	});

	it('accepts valid conditions and actions JSON', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/automations/+page.server.js'
		);
		const fd = makeFormData({
			name: 'Test',
			triggerEvent: 'onCreate',
			conditions: JSON.stringify([{ field: 'status', operator: 'eq', value: 'active' }]),
			actions: JSON.stringify([{ type: 'send_email', config: { to: 'a@b.com' } }]),
		});

		const result = await actions.create({
			request: makeRequest(fd),
			locals: adminLocals,
		} as never);
		expect(result).toEqual({ success: true });
	});
});

describe('Workflow form action validation', () => {
	it('returns 400 for malformed transitions JSON', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/workflow/+page.server.js'
		);
		const fd = makeFormData({
			table: 'orders',
			column: 'status',
			states: 'draft,review',
			transitions: '{not valid json',
		});

		try {
			await actions.create({ request: makeRequest(fd), locals: adminLocals } as never);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) {
				expect(e.status).toBe(400);
			}
		}
	});

	it('returns 400 for structurally invalid transitions', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/workflow/+page.server.js'
		);
		const fd = makeFormData({
			table: 'orders',
			column: 'status',
			states: 'draft,review',
			transitions: JSON.stringify([{ from: 'draft' }]),
		});

		try {
			await actions.create({ request: makeRequest(fd), locals: adminLocals } as never);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) {
				expect(e.status).toBe(400);
			}
		}
	});

	it('accepts valid transitions JSON', async () => {
		const { actions } = await import(
			'$lib/../routes/(app)/settings/workflow/+page.server.js'
		);
		const fd = makeFormData({
			table: 'orders',
			column: 'status',
			states: 'draft,review',
			transitions: JSON.stringify([
				{ from: 'draft', to: 'review', label: 'Submit', roles: ['editor'] },
			]),
		});

		const result = await actions.create({
			request: makeRequest(fd),
			locals: adminLocals,
		} as never);
		expect(result).toEqual({ success: true });
	});
});
