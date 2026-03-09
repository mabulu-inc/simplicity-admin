// packages/core/src/workflow/guards.ts — Guard and condition evaluation

import type { AutomationCondition, TransitionGuard } from './types.js';

/** Record-like object for guard evaluation */
type RecordData = Record<string, unknown>;

/**
 * Parse and evaluate a TransitionGuard's string condition against a record.
 * Supports: =, !=, >, <, >=, <=
 * Returns false for missing fields or unparseable conditions (safe evaluation).
 */
export function evaluateGuard(guard: TransitionGuard, record: RecordData): boolean {
	const parsed = parseCondition(guard.condition);
	if (!parsed) return false;

	const { field, operator, value } = parsed;
	const fieldValue = record[field];
	if (fieldValue === undefined || fieldValue === null) return false;

	return compare(fieldValue, operator, value);
}

/**
 * Evaluate a single structured AutomationCondition against a record.
 * Returns false for missing/null fields (graceful handling).
 */
export function evaluateCondition(condition: AutomationCondition, record: RecordData): boolean {
	const fieldValue = record[condition.field];
	if (fieldValue === undefined || fieldValue === null) return false;

	switch (condition.operator) {
		case 'eq':
			return fieldValue === condition.value;
		case 'neq':
			return fieldValue !== condition.value;
		case 'gt':
			return (fieldValue as number) > (condition.value as number);
		case 'lt':
			return (fieldValue as number) < (condition.value as number);
		case 'gte':
			return (fieldValue as number) >= (condition.value as number);
		case 'lte':
			return (fieldValue as number) <= (condition.value as number);
		case 'in':
			return Array.isArray(condition.value) && (condition.value as unknown[]).includes(fieldValue);
		case 'contains':
			return typeof fieldValue === 'string' && typeof condition.value === 'string'
				&& fieldValue.includes(condition.value);
		default:
			return false;
	}
}

/**
 * Evaluate multiple conditions with AND logic.
 * Returns true if all conditions pass (or if array is empty).
 */
export function evaluateConditions(conditions: AutomationCondition[], record: RecordData): boolean {
	return conditions.every((cond) => evaluateCondition(cond, record));
}

// ── Internal helpers ────────────────────────────────────────────────

interface ParsedCondition {
	field: string;
	operator: string;
	value: string | number;
}

const OPERATOR_PATTERN = /^(\w+)\s*(>=|<=|!=|>|<|=)\s*(.+)$/;

function parseCondition(condition: string): ParsedCondition | null {
	const match = condition.match(OPERATOR_PATTERN);
	if (!match) return null;

	const [, field, operator, rawValue] = match;
	const value = parseValue(rawValue.trim());

	return { field, operator, value };
}

function parseValue(raw: string): string | number {
	// Strip surrounding quotes
	if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
		return raw.slice(1, -1);
	}
	const num = Number(raw);
	if (!Number.isNaN(num)) return num;
	return raw;
}

function compare(fieldValue: unknown, operator: string, conditionValue: string | number): boolean {
	// Coerce for comparison
	const a = typeof conditionValue === 'number' ? Number(fieldValue) : String(fieldValue);
	const b = conditionValue;

	switch (operator) {
		case '=':
			return a === b;
		case '!=':
			return a !== b;
		case '>':
			return a > b;
		case '<':
			return a < b;
		case '>=':
			return a >= b;
		case '<=':
			return a <= b;
		default:
			return false;
	}
}
