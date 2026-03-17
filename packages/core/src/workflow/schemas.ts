// packages/core/src/workflow/schemas.ts — Zod schemas for workflow JSON input validation

import { z } from 'zod';

export const automationConditionSchema = z.object({
	field: z.string(),
	operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
	value: z.unknown(),
});

export const automationActionSchema = z.object({
	type: z.enum(['send_email', 'call_webhook', 'update_record', 'create_record']),
	config: z.record(z.string(), z.unknown()),
});

export const transitionSchema = z.object({
	from: z.string(),
	to: z.string(),
	label: z.string(),
	roles: z.array(z.string()),
	guard: z
		.object({
			condition: z.string(),
		})
		.optional(),
	hooks: z
		.array(
			z.object({
				type: z.enum(['notification', 'webhook', 'update_field']),
				config: z.record(z.string(), z.unknown()),
			}),
		)
		.optional(),
});

export const automationConditionsSchema = z.array(automationConditionSchema);
export const automationActionsSchema = z.array(automationActionSchema);
export const transitionsSchema = z.array(transitionSchema);
