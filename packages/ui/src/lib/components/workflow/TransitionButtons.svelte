<script lang="ts">
	import type { Transition } from '@simplicity-admin/core';

	interface Props {
		transitions: Transition[];
		onTransition?: (toState: string) => void;
		loading: boolean;
	}

	let { transitions, onTransition, loading }: Props = $props();

	function handleClick(toState: string) {
		onTransition?.(toState);
	}
</script>

{#if transitions.length > 0}
	<div class="transition-buttons" data-testid="transition-buttons">
		{#each transitions as t}
			<button
				class="btn btn-transition"
				disabled={loading}
				onclick={() => handleClick(t.to)}
			>
				{t.label}
			</button>
		{/each}
	</div>
{/if}
