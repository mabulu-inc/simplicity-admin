<script lang="ts">
	interface Props {
		title: string;
		chartType: 'bar' | 'line' | 'pie' | 'donut';
		data: { label: string; value: number }[];
		colors?: string[];
		error?: string;
	}

	let { title, chartType, data, colors, error }: Props = $props();

	const maxValue = $derived(Math.max(...data.map((d) => d.value), 1));
</script>

<div class="chart-widget">
	<h3 class="chart-widget-title">{title}</h3>
	{#if error}
		<p class="chart-widget-error">{error}</p>
	{:else if chartType === 'bar'}
		<div class="chart-widget-bars" role="img" aria-label="{title} bar chart">
			{#each data as item, i}
				<div class="chart-widget-bar-group">
					<div
						class="chart-widget-bar"
						style="height: {(item.value / maxValue) * 100}%; background-color: {colors?.[i] ?? 'var(--color-primary, #3b82f6)'}"
					></div>
					<span class="chart-widget-bar-label">{item.label}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="chart-widget-list">
			{#each data as item}
				<div class="chart-widget-list-item">
					<span class="chart-widget-list-label">{item.label}</span>
					<span class="chart-widget-list-value">{item.value}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
