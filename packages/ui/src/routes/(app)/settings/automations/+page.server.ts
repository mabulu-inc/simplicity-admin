import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import { requireAdmin } from '$lib/server/require-admin.js';
import {
	listAutomations,
	createAutomation,
	updateAutomation,
	deleteAutomation,
	automationConditionsSchema,
	automationActionsSchema,
} from '@mabulu-inc/simplicity-admin-core';
import type { Automation, AutomationTrigger } from '@mabulu-inc/simplicity-admin-core';

export interface AutomationsPageData {
	automations: Automation[];
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals.user);

	const pool = getPool();
	const automations = await listAutomations(pool);

	return { automations } satisfies AutomationsPageData;
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals.user);

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const triggerEvent = formData.get('triggerEvent') as AutomationTrigger['event'];
		const triggerTable = (formData.get('triggerTable') as string) || undefined;
		const triggerField = (formData.get('triggerField') as string) || undefined;
		const triggerSchedule = (formData.get('triggerSchedule') as string) || undefined;
		const conditionsRaw = (formData.get('conditions') as string) || '[]';
		const actionsRaw = formData.get('actions') as string;

		if (!name || !triggerEvent) {
			throw error(400, 'Missing required fields');
		}

		let conditionsParsed: unknown;
		try {
			conditionsParsed = JSON.parse(conditionsRaw);
		} catch {
			throw error(400, 'Invalid conditions JSON');
		}
		const conditionsResult = automationConditionsSchema.safeParse(conditionsParsed);
		if (!conditionsResult.success) {
			throw error(400, 'Invalid conditions structure');
		}
		const conditions = conditionsResult.data;

		let actions = [];
		if (actionsRaw) {
			let actionsParsed: unknown;
			try {
				actionsParsed = JSON.parse(actionsRaw);
			} catch {
				throw error(400, 'Invalid actions JSON');
			}
			const actionsResult = automationActionsSchema.safeParse(actionsParsed);
			if (!actionsResult.success) {
				throw error(400, 'Invalid actions structure');
			}
			actions = actionsResult.data;
		}

		const trigger: AutomationTrigger = {
			event: triggerEvent,
			table: triggerTable,
			field: triggerField,
			schedule: triggerSchedule,
		};

		const pool = getPool();
		await createAutomation(pool, {
			name,
			enabled: true,
			trigger,
			conditions,
			actions,
		});

		return { success: true };
	},

	toggle: async ({ request, locals }) => {
		requireAdmin(locals.user);

		const formData = await request.formData();
		const automationId = formData.get('automationId') as string;
		const enabled = formData.get('enabled') === 'true';

		if (!automationId) {
			throw error(400, 'Missing automationId');
		}

		const pool = getPool();
		await updateAutomation(pool, automationId, { enabled });

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		requireAdmin(locals.user);

		const formData = await request.formData();
		const automationId = formData.get('automationId') as string;

		if (!automationId) {
			throw error(400, 'Missing automationId');
		}

		const pool = getPool();
		await deleteAutomation(pool, automationId);

		return { success: true };
	},
};
