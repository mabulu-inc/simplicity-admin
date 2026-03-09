<script lang="ts">
	import AutoForm from '$lib/components/AutoForm.svelte';
	import StateBadge from '$lib/components/workflow/StateBadge.svelte';
	import TransitionButtons from '$lib/components/workflow/TransitionButtons.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	let formError: string | null = $state(null);
	let showDeleteConfirm = $state(false);
	let transitionLoading = $state(false);

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

	const pk = $derived(data.table.primaryKey[0]);
	const recordId = $derived(data.record[pk]);
	const currentState = $derived(
		data.workflow ? (data.record[data.workflow.column] as string | undefined) : undefined,
	);

	async function handleTransition(toState: string) {
		transitionLoading = true;
		formError = null;

		const body = new FormData();
		body.set('toState', toState);

		try {
			const response = await fetch(`/${data.table.name}/${recordId}?/transition`, {
				method: 'POST',
				body,
			});

			if (response.redirected) {
				await goto(response.url);
				return;
			}

			if (!response.ok) {
				const result = await response.json().catch(() => null);
				formError = result?.data?.error ?? 'Failed to perform transition';
			}
		} finally {
			transitionLoading = false;
		}
	}

	async function handleSubmit(formData: Record<string, unknown>) {
		formError = null;

		const body = new FormData();
		body.set('_data', JSON.stringify(formData));

		const response = await fetch(`/${data.table.name}/${recordId}?/update`, {
			method: 'POST',
			body,
		});

		if (response.redirected) {
			await goto(response.url);
			return;
		}

		if (!response.ok) {
			const result = await response.json().catch(() => null);
			formError = result?.data?.error ?? 'Failed to update record';
			return;
		}

		await goto(`/${data.table.name}`);
	}

	function handleDeleteClick() {
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		const body = new FormData();

		const response = await fetch(`/${data.table.name}/${recordId}?/delete`, {
			method: 'POST',
			body,
		});

		if (response.redirected) {
			await goto(response.url);
			return;
		}

		if (!response.ok) {
			const result = await response.json().catch(() => null);
			formError = result?.data?.error ?? 'Failed to delete record';
			showDeleteConfirm = false;
			return;
		}

		await goto(`/${data.table.name}`);
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}
</script>

<div data-testid="edit-view">
	<div class="edit-view-header">
		<div class="edit-view-title-row">
			<h1 data-testid="edit-view-title">Edit {humanize(singularize(data.table.name))}</h1>
			{#if data.workflow && currentState}
				<StateBadge states={data.workflow.states} currentState={currentState} />
			{/if}
		</div>
		<a href="/{data.table.name}" class="btn btn-secondary">Back to list</a>
	</div>

	{#if data.workflow && data.workflow.transitions.length > 0}
		<div class="workflow-actions" data-testid="workflow-actions">
			<TransitionButtons
				transitions={data.workflow.transitions}
				onTransition={handleTransition}
				loading={transitionLoading}
			/>
		</div>
	{/if}

	{#if formError}
		<div class="error-banner" data-testid="form-error">{formError}</div>
	{/if}

	<AutoForm
		columns={data.table.columns}
		values={data.record}
		readOnlyColumns={data.readOnlyColumns}
		hiddenColumns={data.hiddenColumns}
		onSubmit={data.canUpdate ? handleSubmit : undefined}
		onDelete={data.canDelete ? handleDeleteClick : undefined}
	/>

	{#if showDeleteConfirm}
		<div class="confirm-overlay">
			<div class="confirm-dialog" data-testid="confirm-dialog">
				<p>Are you sure you want to delete this record?</p>
				<div class="confirm-actions">
					<button class="btn btn-secondary" onclick={cancelDelete}>Cancel</button>
					<button
						class="btn btn-danger"
						data-testid="confirm-delete-button"
						onclick={confirmDelete}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.edit-view-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.edit-view-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.edit-view-header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.workflow-actions {
		margin-bottom: 1rem;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.375rem;
		color: #dc2626;
	}

	.confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.confirm-dialog {
		background: white;
		border-radius: 0.5rem;
		padding: 1.5rem;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.confirm-dialog p {
		margin: 0 0 1rem;
		font-size: 1rem;
	}

	.confirm-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		border: none;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}

	.btn-danger {
		background-color: #ef4444;
		color: white;
	}
</style>
