<script lang="ts">
	import DashboardGrid from '$lib/components/DashboardGrid.svelte';
	import type { Dashboard, Widget } from '$lib/dashboards/types.js';

	interface PageData {
		dashboard: Dashboard | null;
		dashboards: Dashboard[];
		widgets: Widget[];
		widgetData: Record<string, unknown>;
		widgetErrors: Record<string, string>;
	}

	let { data }: { data: PageData } = $props();
</script>

<div data-testid="dashboard-page">
	{#if data.dashboard}
		<h1>{data.dashboard.name}</h1>
		<div data-testid="dashboard-grid">
			<DashboardGrid
				widgets={data.widgets}
				layout={data.dashboard.layout}
				widgetData={data.widgetData}
				widgetErrors={data.widgetErrors}
			/>
		</div>
	{:else}
		<div data-testid="dashboard-welcome">
			<h1>Welcome to Simplicity Admin</h1>
			<p>No default dashboard has been configured for your role.</p>
			{#if data.dashboards.length > 0}
				<h2>Available Dashboards</h2>
				<ul>
					{#each data.dashboards as dash}
						<li><a href="/dashboard/{dash.slug}">{dash.name}</a></li>
					{/each}
				</ul>
			{:else}
				<p>
					<a href="/dashboard/builder">Create your first dashboard</a>
				</p>
			{/if}
		</div>
	{/if}
</div>
