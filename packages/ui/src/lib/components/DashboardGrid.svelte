<script lang="ts">
	import type { Widget, WidgetLayout, StatConfig, TableConfig, ChartConfig } from '../dashboards/types.js';
	import StatWidget from './widgets/StatWidget.svelte';
	import TableWidget from './widgets/TableWidget.svelte';
	import ChartWidget from './widgets/ChartWidget.svelte';

	interface Props {
		widgets: Widget[];
		layout: WidgetLayout[];
		widgetData: Record<string, unknown>;
		widgetErrors?: Record<string, string>;
	}

	let { widgets, layout, widgetData, widgetErrors = {} }: Props = $props();

	function getWidgetById(id: string): Widget | undefined {
		return widgets.find((w) => w.id === id);
	}

	function extractStatValue(data: unknown): number | null {
		if (typeof data === 'number') return data;
		if (data != null && typeof data === 'object') {
			const vals = Object.values(data as Record<string, unknown>);
			if (vals.length > 0 && typeof vals[0] === 'number') return vals[0];
		}
		return null;
	}
</script>

<div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem;">
	{#each layout as cell}
		{@const widget = getWidgetById(cell.widgetId)}
		{#if widget}
			<div
				class="dashboard-grid-cell"
				style="grid-column: {cell.x + 1} / span {cell.width}; grid-row: {cell.y + 1} / span {cell.height};"
			>
				{#if widgetErrors[widget.id]}
					{#if widget.type === 'stat'}
						<StatWidget title={widget.title} error={widgetErrors[widget.id]} />
					{:else if widget.type === 'table'}
						<TableWidget title={widget.title} columns={[]} rows={[]} error={widgetErrors[widget.id]} />
					{:else}
						<ChartWidget title={widget.title} chartType={(widget.config as ChartConfig).type ?? 'bar'} data={[]} error={widgetErrors[widget.id]} />
					{/if}
				{:else if widget.type === 'stat'}
					{@const config = widget.config as StatConfig}
					<StatWidget
						title={widget.title}
						value={extractStatValue(widgetData[widget.id])}
						format={config.format}
						prefix={config.prefix}
						suffix={config.suffix}
					/>
				{:else if widget.type === 'table'}
					{@const config = widget.config as TableConfig}
					<TableWidget
						title={widget.title}
						columns={config.columns}
						rows={Array.isArray(widgetData[widget.id]) ? widgetData[widget.id] as Record<string, unknown>[] : []}
					/>
				{:else if widget.type === 'chart'}
					{@const config = widget.config as ChartConfig}
					<ChartWidget
						title={widget.title}
						chartType={config.type}
						data={Array.isArray(widgetData[widget.id]) ? widgetData[widget.id] as { label: string; value: number }[] : []}
						colors={config.colors}
					/>
				{/if}
			</div>
		{/if}
	{/each}
</div>
