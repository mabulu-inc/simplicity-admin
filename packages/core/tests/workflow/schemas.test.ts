import { describe, it, expect } from 'vitest';
import {
	automationConditionsSchema,
	automationActionsSchema,
	transitionsSchema,
} from '@mabulu-inc/simplicity-admin-core';

describe('automationConditionsSchema', () => {
	it('accepts valid conditions array', () => {
		const input = [
			{ field: 'status', operator: 'eq', value: 'active' },
			{ field: 'count', operator: 'gt', value: 5 },
		];
		const result = automationConditionsSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('accepts empty array', () => {
		const result = automationConditionsSchema.safeParse([]);
		expect(result.success).toBe(true);
	});

	it('rejects conditions with invalid operator', () => {
		const input = [{ field: 'status', operator: 'INVALID', value: 'x' }];
		const result = automationConditionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it('rejects conditions missing required field', () => {
		const input = [{ operator: 'eq', value: 'x' }];
		const result = automationConditionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it('rejects non-array input', () => {
		const result = automationConditionsSchema.safeParse('not-an-array');
		expect(result.success).toBe(false);
	});

	it('rejects object instead of array', () => {
		const result = automationConditionsSchema.safeParse({ field: 'x', operator: 'eq', value: 1 });
		expect(result.success).toBe(false);
	});
});

describe('automationActionsSchema', () => {
	it('accepts valid actions array', () => {
		const input = [
			{ type: 'send_email', config: { to: 'user@test.com' } },
			{ type: 'call_webhook', config: { url: 'https://example.com' } },
		];
		const result = automationActionsSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('rejects actions with invalid type', () => {
		const input = [{ type: 'destroy_everything', config: {} }];
		const result = automationActionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it('rejects actions missing config', () => {
		const input = [{ type: 'send_email' }];
		const result = automationActionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});
});

describe('transitionsSchema', () => {
	it('accepts valid transitions array', () => {
		const input = [
			{ from: 'draft', to: 'review', label: 'Submit', roles: ['editor'] },
		];
		const result = transitionsSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('accepts transitions with optional guard and hooks', () => {
		const input = [
			{
				from: 'draft',
				to: 'review',
				label: 'Submit',
				roles: ['editor'],
				guard: { condition: 'record.title != null' },
				hooks: [{ type: 'notification', config: { template: 'review' } }],
			},
		];
		const result = transitionsSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('rejects transitions missing required fields', () => {
		const input = [{ from: 'draft' }];
		const result = transitionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it('rejects transitions with invalid hook type', () => {
		const input = [
			{
				from: 'draft',
				to: 'review',
				label: 'Submit',
				roles: ['editor'],
				hooks: [{ type: 'invalid_hook', config: {} }],
			},
		];
		const result = transitionsSchema.safeParse(input);
		expect(result.success).toBe(false);
	});
});
