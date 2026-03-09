import { describe, it, expect } from 'vitest';
import {
	evaluateGuard,
	evaluateCondition,
	evaluateConditions,
} from '../../src/workflow/guards.js';
import type { AutomationCondition, TransitionGuard } from '../../src/workflow/types.js';

describe('evaluateGuard — TransitionGuard string conditions', () => {
	it('evaluates "value > 1000" with value=1500 as true', () => {
		const guard: TransitionGuard = { condition: 'value > 1000' };
		const record = { value: 1500 };
		expect(evaluateGuard(guard, record)).toBe(true);
	});

	it('evaluates "value > 1000" with value=500 as false', () => {
		const guard: TransitionGuard = { condition: 'value > 1000' };
		const record = { value: 500 };
		expect(evaluateGuard(guard, record)).toBe(false);
	});

	it('evaluates "value = 1000" (equality)', () => {
		const guard: TransitionGuard = { condition: 'value = 1000' };
		expect(evaluateGuard(guard, { value: 1000 })).toBe(true);
		expect(evaluateGuard(guard, { value: 999 })).toBe(false);
	});

	it('evaluates "count < 10"', () => {
		const guard: TransitionGuard = { condition: 'count < 10' };
		expect(evaluateGuard(guard, { count: 5 })).toBe(true);
		expect(evaluateGuard(guard, { count: 15 })).toBe(false);
	});

	it('evaluates ">=" and "<=" operators', () => {
		const gte: TransitionGuard = { condition: 'score >= 90' };
		expect(evaluateGuard(gte, { score: 90 })).toBe(true);
		expect(evaluateGuard(gte, { score: 89 })).toBe(false);

		const lte: TransitionGuard = { condition: 'score <= 90' };
		expect(evaluateGuard(lte, { score: 90 })).toBe(true);
		expect(evaluateGuard(lte, { score: 91 })).toBe(false);
	});

	it('evaluates "!=" (inequality)', () => {
		const guard: TransitionGuard = { condition: 'status != draft' };
		expect(evaluateGuard(guard, { status: 'review' })).toBe(true);
		expect(evaluateGuard(guard, { status: 'draft' })).toBe(false);
	});

	it('evaluates string equality with quotes', () => {
		const guard: TransitionGuard = { condition: "status = 'approved'" };
		expect(evaluateGuard(guard, { status: 'approved' })).toBe(true);
		expect(evaluateGuard(guard, { status: 'draft' })).toBe(false);
	});

	it('returns false for missing field (graceful handling)', () => {
		const guard: TransitionGuard = { condition: 'value > 1000' };
		expect(evaluateGuard(guard, {})).toBe(false);
	});

	it('returns false for unparseable condition', () => {
		const guard: TransitionGuard = { condition: 'this is not valid' };
		expect(evaluateGuard(guard, { value: 100 })).toBe(false);
	});
});

describe('evaluateCondition — AutomationCondition structured evaluation', () => {
	it('eq operator — matches', () => {
		const cond: AutomationCondition = { field: 'stage', operator: 'eq', value: 'won' };
		expect(evaluateCondition(cond, { stage: 'won' })).toBe(true);
	});

	it('eq operator — no match', () => {
		const cond: AutomationCondition = { field: 'stage', operator: 'eq', value: 'won' };
		expect(evaluateCondition(cond, { stage: 'lost' })).toBe(false);
	});

	it('neq operator', () => {
		const cond: AutomationCondition = { field: 'stage', operator: 'neq', value: 'won' };
		expect(evaluateCondition(cond, { stage: 'lost' })).toBe(true);
		expect(evaluateCondition(cond, { stage: 'won' })).toBe(false);
	});

	it('gt operator', () => {
		const cond: AutomationCondition = { field: 'amount', operator: 'gt', value: 100 };
		expect(evaluateCondition(cond, { amount: 200 })).toBe(true);
		expect(evaluateCondition(cond, { amount: 50 })).toBe(false);
		expect(evaluateCondition(cond, { amount: 100 })).toBe(false);
	});

	it('lt operator', () => {
		const cond: AutomationCondition = { field: 'amount', operator: 'lt', value: 100 };
		expect(evaluateCondition(cond, { amount: 50 })).toBe(true);
		expect(evaluateCondition(cond, { amount: 200 })).toBe(false);
	});

	it('gte operator', () => {
		const cond: AutomationCondition = { field: 'amount', operator: 'gte', value: 100 };
		expect(evaluateCondition(cond, { amount: 100 })).toBe(true);
		expect(evaluateCondition(cond, { amount: 99 })).toBe(false);
	});

	it('lte operator', () => {
		const cond: AutomationCondition = { field: 'amount', operator: 'lte', value: 100 };
		expect(evaluateCondition(cond, { amount: 100 })).toBe(true);
		expect(evaluateCondition(cond, { amount: 101 })).toBe(false);
	});

	it('in operator', () => {
		const cond: AutomationCondition = { field: 'status', operator: 'in', value: ['active', 'pending'] };
		expect(evaluateCondition(cond, { status: 'active' })).toBe(true);
		expect(evaluateCondition(cond, { status: 'archived' })).toBe(false);
	});

	it('contains operator', () => {
		const cond: AutomationCondition = { field: 'name', operator: 'contains', value: 'test' };
		expect(evaluateCondition(cond, { name: 'my test project' })).toBe(true);
		expect(evaluateCondition(cond, { name: 'production' })).toBe(false);
	});

	it('handles missing field gracefully — returns false', () => {
		const cond: AutomationCondition = { field: 'missing', operator: 'eq', value: 'something' };
		expect(evaluateCondition(cond, {})).toBe(false);
	});

	it('handles null field value gracefully', () => {
		const cond: AutomationCondition = { field: 'value', operator: 'gt', value: 10 };
		expect(evaluateCondition(cond, { value: null })).toBe(false);
	});
});

describe('evaluateConditions — multiple conditions (AND logic)', () => {
	it('returns true when all conditions match', () => {
		const conditions: AutomationCondition[] = [
			{ field: 'stage', operator: 'eq', value: 'won' },
			{ field: 'amount', operator: 'gt', value: 1000 },
		];
		expect(evaluateConditions(conditions, { stage: 'won', amount: 5000 })).toBe(true);
	});

	it('returns false when any condition fails', () => {
		const conditions: AutomationCondition[] = [
			{ field: 'stage', operator: 'eq', value: 'won' },
			{ field: 'amount', operator: 'gt', value: 1000 },
		];
		expect(evaluateConditions(conditions, { stage: 'won', amount: 500 })).toBe(false);
	});

	it('returns true for empty conditions array', () => {
		expect(evaluateConditions([], { anything: 'value' })).toBe(true);
	});
});
