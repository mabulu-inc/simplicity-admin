import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import {
	listStateMachines,
	createStateMachine,
	deleteStateMachine,
} from '@simplicity-admin/core';
import type { StateMachine, StateDefinition } from '@simplicity-admin/core';

export interface WorkflowPageData {
	machines: StateMachine[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
		throw error(403, 'Only admins can manage state machines');
	}

	const pool = getPool();
	const machines = await listStateMachines(pool);

	return { machines } satisfies WorkflowPageData;
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage state machines');
		}

		const formData = await request.formData();
		const table = formData.get('table') as string;
		const column = formData.get('column') as string;
		const statesRaw = formData.get('states') as string;
		const transitionsRaw = formData.get('transitions') as string;

		if (!table || !column || !statesRaw) {
			throw error(400, 'Missing required fields');
		}

		// Parse states: comma-separated names -> StateDefinition[]
		const states: StateDefinition[] = statesRaw.split(',').map((s) => {
			const name = s.trim();
			return { name, label: name.charAt(0).toUpperCase() + name.slice(1) };
		});

		// Parse transitions: JSON array
		let transitions = [];
		if (transitionsRaw) {
			try {
				transitions = JSON.parse(transitionsRaw) as unknown[];
			} catch {
				throw error(400, 'Invalid transitions JSON');
			}
		}

		const pool = getPool();
		await createStateMachine(pool, { table, column, states, transitions });

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can manage state machines');
		}

		const formData = await request.formData();
		const machineId = formData.get('machineId') as string;

		if (!machineId) {
			throw error(400, 'Missing machineId');
		}

		const pool = getPool();
		await deleteStateMachine(pool, machineId);

		return { success: true };
	},
};
