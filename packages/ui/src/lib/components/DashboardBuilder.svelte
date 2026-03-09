<script lang="ts">
	import type { Widget, WidgetLayout } from '../dashboards/types.js';

	interface Props {
		name?: string;
		slug?: string;
		roles?: string[];
		isDefault?: boolean;
		widgets?: Widget[];
		layout?: WidgetLayout[];
		availableRoles?: string[];
	}

	let {
		name = '',
		slug = '',
		roles = [],
		isDefault = false,
		widgets = [],
		layout = [],
		availableRoles = ['app_admin', 'app_editor', 'app_viewer'],
	}: Props = $props();

	let dashboardName = $state(name);
	let dashboardSlug = $state(slug);
	let dashboardRoles = $state<string[]>([...roles]);
	let dashboardIsDefault = $state(isDefault);
	let dashboardWidgets = $state<Widget[]>([...widgets]);
	let dashboardLayout = $state<WidgetLayout[]>([...layout]);

	// New widget form state
	let newWidgetTitle = $state('');
	let newWidgetType = $state<'stat' | 'table' | 'chart'>('stat');
	let newWidgetQuery = $state('');
	let showWidgetForm = $state(false);

	function generateSlug(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function handleNameChange() {
		if (!slug) {
			dashboardSlug = generateSlug(dashboardName);
		}
	}

	function toggleRole(role: string) {
		if (dashboardRoles.includes(role)) {
			dashboardRoles = dashboardRoles.filter((r) => r !== role);
		} else {
			dashboardRoles = [...dashboardRoles, role];
		}
	}

	function addWidget() {
		if (!newWidgetTitle || !newWidgetQuery) return;

		const widgetId = crypto.randomUUID();
		const widget: Widget = {
			id: widgetId,
			type: newWidgetType,
			title: newWidgetTitle,
			config: buildWidgetConfig(newWidgetType, newWidgetQuery),
		};

		dashboardWidgets = [...dashboardWidgets, widget];

		// Auto-layout: place in next available row, full width
		const maxY = dashboardLayout.length > 0
			? Math.max(...dashboardLayout.map((l) => l.y + l.height))
			: 0;

		dashboardLayout = [
			...dashboardLayout,
			{
				widgetId,
				x: 0,
				y: maxY,
				width: newWidgetType === 'stat' ? 4 : 12,
				height: newWidgetType === 'table' ? 3 : 2,
			},
		];

		// Reset form
		newWidgetTitle = '';
		newWidgetQuery = '';
		showWidgetForm = false;
	}

	function buildWidgetConfig(type: 'stat' | 'table' | 'chart', query: string): Widget['config'] {
		switch (type) {
			case 'stat':
				return { query, format: 'number' as const };
			case 'table':
				return { query, columns: [], limit: 10 };
			case 'chart':
				return { type: 'bar' as const, query };
		}
	}

	function removeWidget(widgetId: string) {
		dashboardWidgets = dashboardWidgets.filter((w) => w.id !== widgetId);
		dashboardLayout = dashboardLayout.filter((l) => l.widgetId !== widgetId);
	}
</script>

<div data-testid="dashboard-builder" class="dashboard-builder">
	<h1>Dashboard Builder</h1>

	<form method="POST" action="/dashboard/builder">
		<div class="form-section">
			<label for="dashboard-name">Dashboard Name</label>
			<input
				id="dashboard-name"
				data-testid="dashboard-name-input"
				type="text"
				name="name"
				bind:value={dashboardName}
				oninput={handleNameChange}
				required
			/>
		</div>

		<div class="form-section">
			<label for="dashboard-slug">Slug</label>
			<input
				id="dashboard-slug"
				data-testid="dashboard-slug-input"
				type="text"
				name="slug"
				bind:value={dashboardSlug}
				required
			/>
		</div>

		<div class="form-section">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label>Roles</label>
			<div class="role-checkboxes">
				{#each availableRoles as role}
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={dashboardRoles.includes(role)}
							onchange={() => toggleRole(role)}
						/>
						{role}
					</label>
				{/each}
			</div>
			<input type="hidden" name="roles" value={JSON.stringify(dashboardRoles)} />
		</div>

		<div class="form-section">
			<label class="checkbox-label">
				<input type="checkbox" name="isDefault" bind:checked={dashboardIsDefault} />
				Set as default dashboard
			</label>
		</div>

		<!-- Widgets Section -->
		<div class="form-section">
			<h2>Widgets</h2>
			{#if dashboardWidgets.length > 0}
				<ul class="widget-list" data-testid="widget-list">
					{#each dashboardWidgets as widget}
						<li class="widget-item">
							<span class="widget-type-badge">{widget.type}</span>
							<span>{widget.title}</span>
							<button type="button" class="btn-remove" onclick={() => removeWidget(widget.id)}>Remove</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-state">No widgets added yet.</p>
			{/if}

			{#if showWidgetForm}
				<div class="widget-form" data-testid="widget-form">
					<div class="form-section">
						<label for="widget-title">Widget Title</label>
						<input id="widget-title" data-testid="widget-title-input" type="text" bind:value={newWidgetTitle} />
					</div>
					<div class="form-section">
						<label for="widget-type">Widget Type</label>
						<select id="widget-type" data-testid="widget-type-select" bind:value={newWidgetType}>
							<option value="stat">Stat</option>
							<option value="table">Table</option>
							<option value="chart">Chart</option>
						</select>
					</div>
					<div class="form-section">
						<label for="widget-query">SQL Query</label>
						<textarea id="widget-query" data-testid="widget-query-input" bind:value={newWidgetQuery} rows="3"></textarea>
					</div>
					<div class="widget-form-actions">
						<button type="button" data-testid="add-widget-confirm" onclick={addWidget}>Add Widget</button>
						<button type="button" onclick={() => (showWidgetForm = false)}>Cancel</button>
					</div>
				</div>
			{:else}
				<button type="button" data-testid="add-widget-button" onclick={() => (showWidgetForm = true)}>
					Add Widget
				</button>
			{/if}
		</div>

		<input type="hidden" name="widgets" value={JSON.stringify(dashboardWidgets)} />
		<input type="hidden" name="layout" value={JSON.stringify(dashboardLayout)} />

		<div class="form-actions">
			<button type="submit" data-testid="dashboard-save-button" class="btn-primary">
				Save Dashboard
			</button>
			<a href="/dashboard" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>

<style>
	.dashboard-builder {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
	}

	.form-section {
		margin-bottom: 1rem;
	}

	.form-section label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 600;
	}

	.form-section input[type='text'],
	.form-section textarea,
	.form-section select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.role-checkboxes {
		display: flex;
		gap: 1rem;
	}

	.checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: normal;
	}

	.widget-list {
		list-style: none;
		padding: 0;
	}

	.widget-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid #eee;
		border-radius: 4px;
		margin-bottom: 0.25rem;
	}

	.widget-type-badge {
		background: #e0e7ff;
		color: #3730a3;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.btn-remove {
		margin-left: auto;
		color: #dc2626;
		background: none;
		border: none;
		cursor: pointer;
	}

	.widget-form {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 1rem;
		margin-top: 0.5rem;
	}

	.widget-form-actions {
		display: flex;
		gap: 0.5rem;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-secondary {
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		text-decoration: none;
		color: inherit;
	}

	.empty-state {
		color: #6b7280;
		font-style: italic;
	}
</style>
