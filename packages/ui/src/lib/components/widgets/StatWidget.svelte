<script lang="ts">
	interface Props {
		title: string;
		value?: number | null;
		format?: 'number' | 'currency' | 'percent';
		prefix?: string;
		suffix?: string;
		error?: string;
	}

	let { title, value, format = 'number', prefix = '', suffix = '', error }: Props = $props();

	function formatValue(v: number | null | undefined): string {
		if (v == null) return '—';
		let formatted: string;
		if (format === 'number' || format === 'currency') {
			formatted = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
		} else {
			formatted = String(v);
		}
		return `${prefix}${formatted}${suffix}`;
	}
</script>

<div class="stat-widget">
	<h3 class="stat-widget-title">{title}</h3>
	{#if error}
		<p class="stat-widget-error">{error}</p>
	{:else}
		<p class="stat-widget-value">{formatValue(value)}</p>
	{/if}
</div>
