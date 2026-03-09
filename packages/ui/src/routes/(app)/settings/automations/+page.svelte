<script lang="ts">
	import type { AutomationsPageData } from './+page.server.js';

	interface AutomationsPageProps {
		data: AutomationsPageData;
	}

	let { data }: AutomationsPageProps = $props();

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

	async function handleToggle(automationId: string, currentEnabled: boolean) {
		const formData = new FormData();
		formData.set('automationId', automationId);
		formData.set('enabled', String(!currentEnabled));

		const response = await fetch('?/toggle', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}

	async function handleDelete(automationId: string) {
		const formData = new FormData();
		formData.set('automationId', automationId);

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div data-testid="automations-page" class="automations-page">
	<div class="automations-header">
		<h1>Automations</h1>
		<button data-testid="create-automation-button" class="btn-primary" onclick={() => (showForm = true)}>
			Create Automation
		</button>
	</div>

	{#if showForm}
		<form data-testid="automation-form" class="automation-form" onsubmit={handleCreate}>
			<div class="form-field">
				<label for="automation-name">Name</label>
				<input id="automation-name" data-testid="automation-name-input" name="name" type="text" required />
			</div>

			<div class="form-field">
				<label for="automation-trigger-event">Trigger Event</label>
				<select
					id="automation-trigger-event"
					data-testid="automation-trigger-event-select"
					name="triggerEvent"
					required
				>
					<option value="onCreate">On Create</option>
					<option value="onUpdate">On Update</option>
					<option value="onDelete">On Delete</option>
					<option value="onFieldChange">On Field Change</option>
					<option value="onSchedule">On Schedule</option>
				</select>
			</div>

			<div class="form-field">
				<label for="automation-trigger-table">Table</label>
				<input
					id="automation-trigger-table"
					data-testid="automation-trigger-table-input"
					name="triggerTable"
					type="text"
				/>
			</div>

			<div class="form-field">
				<label for="automation-trigger-field">Field (for field change)</label>
				<input
					id="automation-trigger-field"
					data-testid="automation-trigger-field-input"
					name="triggerField"
					type="text"
				/>
			</div>

			<div class="form-field">
				<label for="automation-trigger-schedule">Schedule (cron)</label>
				<input
					id="automation-trigger-schedule"
					data-testid="automation-trigger-schedule-input"
					name="triggerSchedule"
					type="text"
				/>
			</div>

			<div class="form-field">
				<label for="automation-conditions">Conditions (JSON)</label>
				<textarea
					id="automation-conditions"
					data-testid="automation-conditions-input"
					name="conditions"
					placeholder={'[{"field":"status","operator":"eq","value":"won"}]'}
				></textarea>
			</div>

			<div class="form-field">
				<label for="automation-actions">Actions (JSON)</label>
				<textarea
					id="automation-actions"
					data-testid="automation-actions-input"
					name="actions"
					required
					placeholder={'[{"type":"send_email","config":{"to":"admin@example.com"}}]'}
				></textarea>
			</div>

			<div class="form-actions">
				<button data-testid="automation-save-button" type="submit" class="btn-primary">Save</button>
				<button type="button" class="btn-secondary" onclick={() => (showForm = false)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if data.automations.length === 0 && !showForm}
		<div data-testid="automations-empty" class="automations-empty">
			<p>No automations configured. Create one to get started.</p>
		</div>
	{:else if data.automations.length > 0}
		<div data-testid="automations-list" class="automations-list">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Trigger</th>
						<th>Table</th>
						<th>Conditions</th>
						<th>Actions</th>
						<th>Enabled</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.automations as automation}
						<tr data-testid="automation-row-{automation.id}">
							<td>{automation.name}</td>
							<td>{automation.trigger.event}</td>
							<td>{automation.trigger.table ?? '—'}</td>
							<td>{automation.conditions.length} condition{automation.conditions.length !== 1 ? 's' : ''}</td>
							<td>{automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}</td>
							<td>
								<input
									data-testid="toggle-automation-{automation.id}"
									type="checkbox"
									checked={automation.enabled}
									onchange={() => handleToggle(automation.id, automation.enabled)}
								/>
							</td>
							<td>
								<button
									data-testid="delete-automation-{automation.id}"
									class="btn-danger"
									onclick={() => handleDelete(automation.id)}
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
