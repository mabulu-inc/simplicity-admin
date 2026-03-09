<script lang="ts">
	import type { StateDefinition } from '@simplicity-admin/core';

	interface Props {
		states: StateDefinition[];
		currentState: string;
	}

	let { states, currentState }: Props = $props();

	const stateDef = $derived(states.find((s) => s.name === currentState));
	const label = $derived(stateDef?.label ?? currentState);
	const color = $derived(stateDef?.color ?? 'gray');
</script>

<span class="state-badge badge-{color}" data-testid="state-badge">
	{label}
</span>
