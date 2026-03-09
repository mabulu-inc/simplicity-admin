<script lang="ts">
	import DashboardGrid from '$lib/components/DashboardGrid.svelte';
	import type { Dashboard, Widget } from '$lib/dashboards/types.js';

	interface PageData {
		dashboard: Dashboard;
		widgets: Widget[];
		widgetData: Record<string, unknown>;
		widgetErrors: Record<string, string>;
	}

	let { data }: { data: PageData } = $props();
</script>

<div data-testid="dashboard-page">
	<h1>{data.dashboard.name}</h1>
	<div data-testid="dashboard-grid">
		<DashboardGrid
			widgets={data.widgets}
			layout={data.dashboard.layout}
			widgetData={data.widgetData}
			widgetErrors={data.widgetErrors}
		/>
	</div>
</div>
