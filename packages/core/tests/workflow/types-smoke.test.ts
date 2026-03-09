import { describe, it, expect } from 'vitest';
import type {
	StateMachine,
	StateDefinition,
	Transition,
	TransitionGuard,
	TransitionHook,
	NotificationHookConfig,
	WebhookHookConfig,
	UpdateFieldHookConfig,
	Automation,
	AutomationTrigger,
	AutomationCondition,
	AutomationAction,
	TransitionResult,
	TransitionLogEntry,
	AutomationResult,
} from '@simplicity-admin/core';

describe('Workflow types smoke test', () => {
	it('StateMachine type is structurally valid', () => {
		const machine: StateMachine = {
			id: 'sm-1',
			table: 'deals',
			column: 'status',
			states: [
				{ name: 'draft', label: 'Draft' },
				{ name: 'review', label: 'Review', color: 'yellow' },
				{ name: 'approved', label: 'Approved', isFinal: true },
			],
			transitions: [
				{
					from: 'draft',
					to: 'review',
					label: 'Submit for Review',
					roles: ['app_editor', 'app_admin'],
				},
			],
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(machine.id).toBe('sm-1');
		expect(machine.states).toHaveLength(3);
		expect(machine.transitions).toHaveLength(1);
	});

	it('Transition with guard and hooks is valid', () => {
		const guard: TransitionGuard = { condition: 'value > 1000' };
		const hook: TransitionHook = {
			type: 'notification',
			config: {
				recipients: { type: 'roles', roles: ['app_admin'] },
			} satisfies NotificationHookConfig,
		};
		const transition: Transition = {
			from: 'draft',
			to: 'review',
			label: 'Submit',
			roles: ['app_editor'],
			guard,
			hooks: [hook],
		};
		expect(transition.guard?.condition).toBe('value > 1000');
		expect(transition.hooks).toHaveLength(1);
	});

	it('WebhookHookConfig type is valid', () => {
		const config: WebhookHookConfig = {
			url: 'https://example.com/hook',
			method: 'POST',
			headers: { Authorization: 'Bearer token' },
			bodyTemplate: '{"id": "{{id}}"}',
		};
		expect(config.method).toBe('POST');
	});

	it('UpdateFieldHookConfig type is valid', () => {
		const config: UpdateFieldHookConfig = {
			field: 'reviewed_at',
			value: '{{now}}',
		};
		expect(config.field).toBe('reviewed_at');
	});

	it('Automation type is structurally valid', () => {
		const automation: Automation = {
			id: 'auto-1',
			name: 'Deal Won Notifier',
			enabled: true,
			trigger: {
				event: 'onFieldChange',
				table: 'deals',
				field: 'stage',
			},
			conditions: [
				{ field: 'stage', operator: 'eq', value: 'won' },
			],
			actions: [
				{
					type: 'send_email',
					config: { to: 'sales@example.com', subject: 'Deal Won!' },
				},
			],
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		expect(automation.name).toBe('Deal Won Notifier');
		expect(automation.conditions).toHaveLength(1);
		expect(automation.actions).toHaveLength(1);
	});

	it('AutomationTrigger schedule variant is valid', () => {
		const trigger: AutomationTrigger = {
			event: 'onSchedule',
			schedule: '0 9 * * MON',
		};
		expect(trigger.event).toBe('onSchedule');
	});

	it('AutomationCondition operators are valid', () => {
		const conditions: AutomationCondition[] = [
			{ field: 'age', operator: 'gt', value: 18 },
			{ field: 'status', operator: 'in', value: ['active', 'pending'] },
			{ field: 'name', operator: 'contains', value: 'test' },
			{ field: 'count', operator: 'lte', value: 100 },
		];
		expect(conditions).toHaveLength(4);
	});

	it('TransitionResult type is valid', () => {
		const result: TransitionResult = {
			success: true,
			fromState: 'draft',
			toState: 'review',
			hooksExecuted: [
				{ type: 'notification', success: true },
				{ type: 'webhook', success: false, error: 'Timeout' },
			],
		};
		expect(result.success).toBe(true);
		expect(result.hooksExecuted).toHaveLength(2);
	});

	it('TransitionLogEntry type is valid', () => {
		const entry: TransitionLogEntry = {
			id: 'log-1',
			fromState: 'draft',
			toState: 'review',
			userId: 'user-1',
			comment: 'Looks good',
			timestamp: new Date(),
		};
		expect(entry.fromState).toBe('draft');
	});

	it('AutomationResult type is valid', () => {
		const result: AutomationResult = {
			automationId: 'auto-1',
			automationName: 'Deal Won Notifier',
			triggered: true,
			actionsExecuted: [
				{ type: 'send_email', success: true },
			],
		};
		expect(result.triggered).toBe(true);
	});
});
