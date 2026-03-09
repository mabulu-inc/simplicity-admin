import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import {
	listAutomations,
	createAutomation,
	updateAutomation,
	deleteAutomation,
} from '@simplicity-admin/core';
import type { Automation, AutomationTrigger } from '@simplicity-admin/core';

export interface AutomationsPageData {
	automations: Automation[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
		throw error(403, 'Only admins can manage automations');
	}

	const pool = getPool();
	const automations = await listAutomations(pool);

	return { automations } satisfies AutomationsPageData;
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage automations');
		}

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

		let conditions = [];
		try {
			conditions = JSON.parse(conditionsRaw) as unknown[];
		} catch {
			throw error(400, 'Invalid conditions JSON');
		}

		let actions = [];
		if (actionsRaw) {
			try {
				actions = JSON.parse(actionsRaw) as unknown[];
			} catch {
				throw error(400, 'Invalid actions JSON');
			}
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
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage automations');
		}

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
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage automations');
		}

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
