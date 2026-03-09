<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		error?: string;
		children: Snippet;
	}

	let { title, error, children }: Props = $props();
</script>

<div class="widget-container">
	<h3 class="widget-container-title">{title}</h3>
	{#if error}
		<p class="widget-container-error">{error}</p>
	{:else}
		{@render children()}
	{/if}
</div>
