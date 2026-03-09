<script lang="ts">
	import type { NotificationRulesPageData } from './+page.server.js';

	interface NotificationRulesPageProps {
		data: NotificationRulesPageData;
	}

	let { data }: NotificationRulesPageProps = $props();

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

	async function handleToggle(ruleId: string, currentEnabled: boolean) {
		const formData = new FormData();
		formData.set('ruleId', ruleId);
		formData.set('enabled', String(!currentEnabled));

		const response = await fetch('?/toggle', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}

	async function handleDelete(ruleId: string) {
		const formData = new FormData();
		formData.set('ruleId', ruleId);

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div data-testid="notification-rules-page" class="notification-rules-page">
	<div class="rules-header">
		<h1>Notification Rules</h1>
		<button data-testid="create-rule-button" class="btn-primary" onclick={() => (showForm = true)}>
			Create Rule
		</button>
	</div>

	{#if showForm}
		<form data-testid="rule-form" class="rule-form" onsubmit={handleCreate}>
			<div class="form-field">
				<label for="rule-name">Name</label>
				<input id="rule-name" data-testid="rule-name-input" name="name" type="text" required />
			</div>

			<div class="form-field">
				<label for="rule-trigger">Trigger</label>
				<select id="rule-trigger" data-testid="rule-trigger-select" name="trigger" required>
					<option value="record.created">Record Created</option>
					<option value="record.updated">Record Updated</option>
					<option value="record.deleted">Record Deleted</option>
					<option value="field.changed">Field Changed</option>
					<option value="schedule">Schedule</option>
				</select>
			</div>

			<div class="form-field">
				<label for="rule-table">Table</label>
				<input id="rule-table" data-testid="rule-table-input" name="table" type="text" />
			</div>

			<div class="form-field">
				<label for="rule-field">Field (for field.changed)</label>
				<input id="rule-field" data-testid="rule-field-input" name="field" type="text" />
			</div>

			<div class="form-field">
				<label for="rule-condition">Condition</label>
				<input id="rule-condition" data-testid="rule-condition-input" name="condition" type="text" placeholder="status = 'urgent'" />
			</div>

			<div class="form-field">
				<label for="rule-subject">Subject Template</label>
				<input id="rule-subject" data-testid="rule-subject-input" name="subject" type="text" required placeholder={'New contact: {{first_name}}'} />
			</div>

			<div class="form-field">
				<label for="rule-body">Body Template</label>
				<textarea id="rule-body" data-testid="rule-body-input" name="body" required></textarea>
			</div>

			<div class="form-field">
				<label for="rule-schedule">Schedule (cron, for schedule trigger)</label>
				<input id="rule-schedule" data-testid="rule-schedule-input" name="schedule" type="text" />
			</div>

			<fieldset class="form-field">
				<legend>Channels</legend>
				<label>
					<input data-testid="rule-channel-in_app" name="channel_in_app" type="checkbox" value="true" checked />
					In-App
				</label>
				<label>
					<input data-testid="rule-channel-email" name="channel_email" type="checkbox" value="true" />
					Email
				</label>
			</fieldset>

			<div class="form-actions">
				<button data-testid="rule-save-button" type="submit" class="btn-primary">Save Rule</button>
				<button type="button" class="btn-secondary" onclick={() => (showForm = false)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if data.rules.length === 0 && !showForm}
		<div data-testid="rules-empty" class="rules-empty">
			<p>No notification rules configured. Create one to get started.</p>
		</div>
	{:else if data.rules.length > 0}
		<div data-testid="rules-list" class="rules-list">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Trigger</th>
						<th>Table</th>
						<th>Channels</th>
						<th>Enabled</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rules as rule}
						<tr data-testid="rule-row-{rule.id}">
							<td>{rule.name}</td>
							<td>{rule.trigger}</td>
							<td>{rule.table ?? '—'}</td>
							<td>{rule.channels.join(', ')}</td>
							<td>
								<input
									type="checkbox"
									checked={rule.enabled}
									onchange={() => handleToggle(rule.id, rule.enabled)}
								/>
							</td>
							<td>
								<button
									data-testid="delete-rule-{rule.id}"
									class="btn-danger"
									onclick={() => handleDelete(rule.id)}
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
