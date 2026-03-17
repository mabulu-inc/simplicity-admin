import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import { listRules, createRule, updateRule, deleteRule } from '@mabulu-inc/simplicity-admin-core';
import type { NotificationChannel, TriggerEvent, NotificationRule } from '@mabulu-inc/simplicity-admin-core';

export interface NotificationRulesPageData {
	rules: NotificationRule[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
		throw error(403, 'Only admins can manage notification rules');
	}

	const pool = getPool();
	const rules = await listRules(pool);

	return { rules } satisfies NotificationRulesPageData;
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage notification rules');
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const trigger = formData.get('trigger') as TriggerEvent;
		const table = (formData.get('table') as string) || undefined;
		const field = (formData.get('field') as string) || undefined;
		const condition = (formData.get('condition') as string) || undefined;
		const subject = formData.get('subject') as string;
		const body = formData.get('body') as string;
		const schedule = (formData.get('schedule') as string) || undefined;

		// Collect channels
		const channels: NotificationChannel[] = [];
		if (formData.get('channel_in_app')) channels.push('in_app');
		if (formData.get('channel_email')) channels.push('email');
		if (channels.length === 0) channels.push('in_app');

		if (!name || !trigger || !subject || !body) {
			throw error(400, 'Missing required fields');
		}

		const pool = getPool();
		await createRule(pool, {
			name,
			enabled: true,
			trigger,
			table,
			field,
			condition,
			channels,
			template: { subject, body },
			recipients: { type: 'roles', roles: ['app_admin'] },
			schedule,
			createdBy: locals.user.userId,
		});

		return { success: true };
	},

	toggle: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage notification rules');
		}

		const formData = await request.formData();
		const ruleId = formData.get('ruleId') as string;
		const enabled = formData.get('enabled') === 'true';

		if (!ruleId) {
			throw error(400, 'Missing ruleId');
		}

		const pool = getPool();
		await updateRule(pool, ruleId, { enabled });

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage notification rules');
		}

		const formData = await request.formData();
		const ruleId = formData.get('ruleId') as string;

		if (!ruleId) {
			throw error(400, 'Missing ruleId');
		}

		const pool = getPool();
		await deleteRule(pool, ruleId);

		return { success: true };
	},
};
