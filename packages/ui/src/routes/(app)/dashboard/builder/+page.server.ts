import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import { createDashboard, createWidget } from '$lib/dashboards/manager.js';
import type { Widget, WidgetLayout } from '$lib/dashboards/types.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Only admins can access the builder
	if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
		throw error(403, 'Only admins can create dashboards');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}
		if (locals.user.activeRole !== 'app_admin' && !locals.user.superAdmin) {
			throw error(403, 'Only admins can create dashboards');
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const slug = formData.get('slug') as string;
		const rolesJson = formData.get('roles') as string;
		const isDefault = formData.get('isDefault') === 'on';
		const widgetsJson = formData.get('widgets') as string;
		const layoutJson = formData.get('layout') as string;

		if (!name || !slug) {
			throw error(400, 'Name and slug are required');
		}

		const pool = getPool();
		const roles: string[] = rolesJson ? JSON.parse(rolesJson) : [];
		const clientWidgets: Widget[] = widgetsJson ? JSON.parse(widgetsJson) : [];
		const clientLayout: WidgetLayout[] = layoutJson ? JSON.parse(layoutJson) : [];

		// Create widgets in the database and build an ID mapping
		const idMap = new Map<string, string>();
		for (const w of clientWidgets) {
			const created = await createWidget(pool, {
				type: w.type,
				title: w.title,
				config: w.config,
			});
			idMap.set(w.id, created.id);
		}

		// Remap layout widget IDs to the newly created DB IDs
		const finalLayout: WidgetLayout[] = clientLayout.map((l) => ({
			...l,
			widgetId: idMap.get(l.widgetId) ?? l.widgetId,
		}));

		const dashboard = await createDashboard(pool, {
			name,
			slug,
			roles,
			isDefault,
			layout: finalLayout,
			createdBy: locals.user.userId,
		});

		throw redirect(303, `/dashboard/${dashboard.slug}`);
	},
};
