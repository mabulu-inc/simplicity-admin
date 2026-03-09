<script lang="ts">
	import type { WorkflowPageData } from './+page.server.js';

	interface WorkflowPageProps {
		data: WorkflowPageData;
	}

	let { data }: WorkflowPageProps = $props();

	let showForm = $state(false);

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);

		const response = await fetch('?/create', { method: 'POST', body: formData });
		if (response.ok) {
			showForm = false;
			window.location.reload();
		}
	}

	async function handleDelete(machineId: string) {
		const formData = new FormData();
		formData.set('machineId', machineId);

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div data-testid="workflow-page" class="workflow-page">
	<div class="workflow-header">
		<h1>State Machines</h1>
		<button data-testid="create-machine-button" class="btn-primary" onclick={() => (showForm = true)}>
			Create State Machine
		</button>
	</div>

	{#if showForm}
		<form data-testid="machine-form" class="machine-form" onsubmit={handleCreate}>
			<div class="form-field">
				<label for="machine-table">Table</label>
				<input id="machine-table" data-testid="machine-table-input" name="table" type="text" required />
			</div>

			<div class="form-field">
				<label for="machine-column">State Column</label>
				<input id="machine-column" data-testid="machine-column-input" name="column" type="text" required />
			</div>

			<div class="form-field">
				<label for="machine-states">States (comma-separated)</label>
				<input
					id="machine-states"
					data-testid="machine-states-input"
					name="states"
					type="text"
					required
					placeholder="draft,review,published"
				/>
			</div>

			<div class="form-field">
				<label for="machine-transitions">Transitions (JSON)</label>
				<textarea
					id="machine-transitions"
					data-testid="machine-transitions-input"
					name="transitions"
					placeholder={'[{"from":"draft","to":"review","label":"Submit","roles":["app_admin"]}]'}
				></textarea>
			</div>

			<div class="form-actions">
				<button data-testid="machine-save-button" type="submit" class="btn-primary">Save</button>
				<button type="button" class="btn-secondary" onclick={() => (showForm = false)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if data.machines.length === 0 && !showForm}
		<div data-testid="machines-empty" class="machines-empty">
			<p>No state machines configured. Create one to get started.</p>
		</div>
	{:else if data.machines.length > 0}
		<div data-testid="machines-list" class="machines-list">
			<table>
				<thead>
					<tr>
						<th>Table</th>
						<th>Column</th>
						<th>States</th>
						<th>Transitions</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.machines as machine}
						<tr data-testid="machine-row-{machine.id}">
							<td>{machine.table}</td>
							<td>{machine.column}</td>
							<td>{machine.states.map((s) => s.label).join(', ')}</td>
							<td>{machine.transitions.length} transition{machine.transitions.length !== 1 ? 's' : ''}</td>
							<td>
								<button
									data-testid="delete-machine-{machine.id}"
									class="btn-danger"
									onclick={() => handleDelete(machine.id)}
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
