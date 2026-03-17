import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPool } from '$lib/server/db.js';
import {
	getDefaultDashboard,
	listDashboards,
	executeWidgetQuery,
	mapWidgetRow,
} from '$lib/dashboards/manager.js';
import type { Widget } from '$lib/dashboards/types.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const pool = getPool();
	const role = locals.user.activeRole;
	const tenantId = locals.user.tenantId;

	// Try to find a default dashboard for the user's role
	const dashboard = await getDefaultDashboard(pool, role);

	if (!dashboard) {
		// No default dashboard — return welcome state
		const dashboards = await listDashboards(pool, role);
		return { dashboard: null, dashboards, widgetData: {}, widgetErrors: {}, widgets: [] };
	}

	// Load all widgets referenced by the dashboard layout
	const widgetIds = dashboard.layout.map((l) => l.widgetId);
	let widgets: Widget[] = [];
	if (widgetIds.length > 0) {
		const result = await pool.query<{ id: string; type: string; title: string; config: Record<string, unknown> }>(
			`SELECT * FROM simplicity_widgets WHERE id = ANY($1)`,
			[widgetIds],
		);
		widgets = result.rows.map(mapWidgetRow);
	}

	// Execute each widget query, capturing errors per-widget
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

	const dashboards = await listDashboards(pool, role);

	return { dashboard, dashboards, widgets, widgetData, widgetErrors };
};
