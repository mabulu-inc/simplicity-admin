// packages/core/src/workflow/actions.ts — Workflow action executors

import type { ConnectionPool } from '../providers/types.js';
import type { NotificationEngine } from '../notifications/engine.js';
import { interpolateTemplate } from '../notifications/rules.js';
import type {
	TransitionHook,
	NotificationHookConfig,
	WebhookHookConfig,
	UpdateFieldHookConfig,
	AutomationAction,
} from './types.js';

/** Context passed to action executors */
export interface ActionExecutorContext {
	pool: ConnectionPool;
	notificationEngine: NotificationEngine;
	record: Record<string, unknown>;
	table: string;
	recordId: string;
	tenantId?: string;
}

/** Result from executing a single action/hook */
export interface ActionExecutorResult {
	type: string;
	success: boolean;
	error?: string;
}

// ── TransitionHook Executors ────────────────────────────────────────

/**
 * Execute a transition hook. Never throws — returns a result with
 * success=false on failure (hooks are non-blocking per spec B-WF-005).
 */
export async function executeHook(
	hook: TransitionHook,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	try {
		switch (hook.type) {
			case 'notification':
				return await executeNotificationHook(hook.config as NotificationHookConfig, ctx);
			case 'webhook':
				return await executeWebhookHook(hook.config as WebhookHookConfig, ctx);
			case 'update_field':
				return await executeUpdateFieldHook(hook.config as UpdateFieldHookConfig, ctx);
			default:
				return { type: hook.type, success: false, error: `Unknown hook type: ${hook.type}` };
		}
	} catch (err) {
		return { type: hook.type, success: false, error: (err as Error).message };
	}
}

// ── AutomationAction Executors ──────────────────────────────────────

/**
 * Execute an automation action. Never throws — returns a result with
 * success=false on failure (actions are non-blocking per spec).
 */
export async function executeAction(
	action: AutomationAction,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	try {
		switch (action.type) {
			case 'send_email':
				return await executeSendEmail(action.config, ctx);
			case 'call_webhook':
				return await executeCallWebhook(action.config, ctx);
			case 'update_record':
				return await executeUpdateRecord(action.config, ctx);
			case 'create_record':
				return await executeCreateRecord(action.config, ctx);
			default:
				return { type: action.type, success: false, error: `Unknown action type: ${action.type}` };
		}
	} catch (err) {
		return { type: action.type, success: false, error: (err as Error).message };
	}
}

// ── Internal executors ──────────────────────────────────────────────

async function executeNotificationHook(
	config: NotificationHookConfig,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const template = config.template;
	if (!template) {
		return { type: 'notification', success: false, error: 'No template provided' };
	}

	const subject = interpolateTemplate(template.subject, ctx.record);
	const body = interpolateTemplate(template.body, ctx.record);
	const userIds = resolveRecipientUserIds(config.recipients);

	for (const userId of userIds) {
		await ctx.notificationEngine.send({
			userId,
			channel: 'in_app',
			subject,
			body,
			read: false,
			ruleId: '',
			recordId: ctx.recordId,
			tableName: ctx.table,
		});
	}

	return { type: 'notification', success: true };
}

async function executeWebhookHook(
	config: WebhookHookConfig,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...config.headers,
	};

	let body: string;
	if (config.bodyTemplate) {
		body = interpolateTemplate(config.bodyTemplate, ctx.record);
	} else {
		body = JSON.stringify({
			table: ctx.table,
			recordId: ctx.recordId,
			record: ctx.record,
		});
	}

	const response = await fetch(config.url, {
		method: config.method,
		headers,
		body,
	});

	if (!response.ok) {
		return {
			type: 'webhook',
			success: false,
			error: `Webhook failed: ${response.status} ${response.statusText}`,
		};
	}

	return { type: 'webhook', success: true };
}

async function executeUpdateFieldHook(
	config: UpdateFieldHookConfig,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const resolvedValue = interpolateTemplate(config.value, ctx.record);
	const identifier = quoteIdentifier(config.field);
	const tableIdentifier = quoteIdentifier(ctx.table);

	await ctx.pool.query(
		`UPDATE ${tableIdentifier} SET ${identifier} = $1 WHERE id = $2`,
		[resolvedValue, ctx.recordId],
	);

	return { type: 'update_field', success: true };
}

async function executeSendEmail(
	config: Record<string, unknown>,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const subject = interpolateTemplate(String(config.subject ?? ''), ctx.record);
	const body = interpolateTemplate(String(config.body ?? ''), ctx.record);
	const recipients = config.recipients as { type: string; userIds?: string[]; roles?: string[] } | undefined;
	const userIds = recipients ? resolveRecipientUserIds(recipients as import('../notifications/types.js').RecipientConfig) : [];

	for (const userId of userIds) {
		await ctx.notificationEngine.send({
			userId,
			channel: 'email',
			subject,
			body,
			read: false,
			ruleId: '',
			recordId: ctx.recordId,
			tableName: ctx.table,
		});
	}

	return { type: 'send_email', success: true };
}

async function executeCallWebhook(
	config: Record<string, unknown>,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const url = String(config.url ?? '');
	const method = String(config.method ?? 'POST');
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(config.headers as Record<string, string> | undefined),
	};

	let body: string;
	if (config.bodyTemplate) {
		body = interpolateTemplate(String(config.bodyTemplate), ctx.record);
	} else {
		body = JSON.stringify({
			table: ctx.table,
			recordId: ctx.recordId,
			record: ctx.record,
		});
	}

	const response = await fetch(url, { method, headers, body });

	if (!response.ok) {
		return {
			type: 'call_webhook',
			success: false,
			error: `Webhook failed: ${response.status} ${response.statusText}`,
		};
	}

	return { type: 'call_webhook', success: true };
}

async function executeUpdateRecord(
	config: Record<string, unknown>,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const field = String(config.field ?? '');
	const value = interpolateTemplate(String(config.value ?? ''), ctx.record);
	const identifier = quoteIdentifier(field);
	const tableIdentifier = quoteIdentifier(ctx.table);

	await ctx.pool.query(
		`UPDATE ${tableIdentifier} SET ${identifier} = $1 WHERE id = $2`,
		[value, ctx.recordId],
	);

	return { type: 'update_record', success: true };
}

async function executeCreateRecord(
	config: Record<string, unknown>,
	ctx: ActionExecutorContext,
): Promise<ActionExecutorResult> {
	const targetTable = String(config.table ?? ctx.table);
	const data = config.data as Record<string, string> | undefined;
	if (!data || Object.keys(data).length === 0) {
		return { type: 'create_record', success: false, error: 'No data provided for create_record' };
	}

	const entries = Object.entries(data);
	const columns = entries.map(([col]) => quoteIdentifier(col));
	const values = entries.map(([, val]) => interpolateTemplate(String(val), ctx.record));
	const placeholders = entries.map((_, i) => `$${i + 1}`);
	const tableIdentifier = quoteIdentifier(targetTable);

	await ctx.pool.query(
		`INSERT INTO ${tableIdentifier} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
		values,
	);

	return { type: 'create_record', success: true };
}

// ── Helpers ─────────────────────────────────────────────────────────

function resolveRecipientUserIds(recipients: import('../notifications/types.js').RecipientConfig): string[] {
	if (recipients.type === 'users' && recipients.userIds) {
		return recipients.userIds;
	}
	// Role-based and field-based resolution requires DB queries;
	// handled by the notification engine in full context.
	return [];
}

/** Quote a SQL identifier to prevent injection. Only allows alphanumeric + underscore. */
function quoteIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid SQL identifier: ${name}`);
	}
	return `"${name}"`;
}
