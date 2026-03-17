import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPool } from '$lib/server/db.js';
import { getDashboardBySlug, executeWidgetQuery, mapWidgetRow } from '$lib/dashboards/manager.js';
import type { Widget } from '$lib/dashboards/types.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const pool = getPool();
	const tenantId = locals.user.tenantId;
	const dashboard = await getDashboardBySlug(pool, params.slug);

	if (!dashboard) {
		throw error(404, 'Dashboard not found');
	}

	// Check role access: if dashboard has roles specified, user must have one
	if (dashboard.roles.length > 0 && !dashboard.roles.includes(locals.user.activeRole)) {
		throw error(403, 'You do not have access to this dashboard');
	}

	// Load widgets
	const widgetIds = dashboard.layout.map((l) => l.widgetId);
	let widgets: Widget[] = [];
	if (widgetIds.length > 0) {
		const result = await pool.query<{ id: string; type: string; title: string; config: Record<string, unknown> }>(
			`SELECT * FROM simplicity_widgets WHERE id = ANY($1)`,
			[widgetIds],
		);
		widgets = result.rows.map(mapWidgetRow);
	}

	// Execute widget queries
	const widgetData: Record<string, unknown> = {};
	const widgetErrors: Record<string, string> = {};

	await Promise.allSettled(
		widgets.map(async (widget) => {
			try {
				widgetData[widget.id] = await executeWidgetQuery(pool, widget, tenantId);
			} catch (err) {
				widgetErrors[widget.id] = err instanceof Error ? err.message : 'Widget query failed';
			}
		}),
	);

	return { dashboard, widgets, widgetData, widgetErrors };
};
