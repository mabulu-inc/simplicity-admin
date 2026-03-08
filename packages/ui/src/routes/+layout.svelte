<script lang="ts">
	import type { Snippet } from 'svelte';

	interface LayoutProps {
		children: Snippet;
	}

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Simplicity Admin</title>
</svelte:head>

{@render children()}
