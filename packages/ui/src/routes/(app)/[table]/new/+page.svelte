<script lang="ts">
	import AutoForm from '$lib/components/AutoForm.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let formError: string | null = $state(null);

	function humanize(name: string): string {
		return name
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	function singularize(name: string): string {
		if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
		if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes'))
			return name.slice(0, -2);
		if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
		return name;
	}

	async function handleSubmit(formData: Record<string, unknown>) {
		formError = null;

		const body = new FormData();
		body.set('_data', JSON.stringify(formData));

		const response = await fetch(`/${data.table.name}/new`, {
			method: 'POST',
			body,
		});

		if (response.redirected) {
			await goto(response.url);
			return;
		}

		// Handle non-redirect responses
		if (!response.ok) {
			const result = await response.json().catch(() => null);
			formError = result?.data?.error ?? 'Failed to create record';
			return;
		}

		// SvelteKit form action success without redirect
		await goto(`/${data.table.name}`);
	}
</script>

<div data-testid="create-view">
	<div class="create-view-header">
		<h1 data-testid="create-view-title">Create {humanize(singularize(data.table.name))}</h1>
		<a href="/{data.table.name}" class="btn btn-secondary">Back to list</a>
	</div>

	{#if formError}
		<div class="error-banner" data-testid="form-error">{formError}</div>
	{/if}

	<AutoForm columns={data.table.columns} onSubmit={handleSubmit} />
</div>

<style>
	.create-view-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.create-view-header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.375rem;
		color: #dc2626;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}
</style>
