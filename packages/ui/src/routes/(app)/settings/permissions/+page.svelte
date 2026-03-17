<script lang="ts">
	import type { Operation } from '@mabulu-inc/simplicity-admin-auth';
	import type { PermissionsPageData, TablePermissionRow, ColumnPermissionRow } from './+page.server.js';

	interface PermissionsPageProps {
		data: PermissionsPageData;
	}

	let { data }: PermissionsPageProps = $props();

	const operations: Operation[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
	let expandedTables = $state<Set<string>>(new Set());

	function toggleExpand(table: string) {
		const next = new Set(expandedTables);
		if (next.has(table)) {
			next.delete(table);
		} else {
			next.add(table);
		}
		expandedTables = next;
	}

	function isOverridden(table: string, column: string | undefined, operation: Operation): boolean {
		return data.overrides.some(
			(o) =>
				o.table === table &&
				(o.column ?? undefined) === column &&
				o.operation === operation,
		);
	}

	async function handleToggle(
		table: string,
		column: string | undefined,
		operation: Operation,
		currentlyAllowed: boolean,
		ceilingAllowed: boolean,
	) {
		// Cannot grant beyond ceiling
		if (!currentlyAllowed && !ceilingAllowed) return;

		const formData = new FormData();
		formData.set('role', data.selectedRole);
		formData.set('table', table);
		if (column) formData.set('column', column);
		formData.set('operation', operation);
		formData.set('action', currentlyAllowed ? 'deny' : 'restore');

		const response = await fetch('?/toggle', {
			method: 'POST',
			body: formData,
		});

		if (response.ok) {
			// Reload the page to reflect changes
			window.location.reload();
		}
	}

	function handleRoleChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		window.location.href = `/settings/permissions?role=${encodeURIComponent(select.value)}`;
	}
</script>

<div class="permissions-page">
	<h1>Permissions</h1>
	<p>Manage role-based permissions. You can restrict (deny) permissions but cannot grant beyond the code-defined ceiling.</p>

	<div class="role-selector">
		<label for="role-select">Role:</label>
		<select
			id="role-select"
			data-testid="role-select"
			value={data.selectedRole}
			onchange={handleRoleChange}
		>
			{#each data.roles as role}
				<option value={role}>{role.replace('app_', '').replace(/^\w/, (c) => c.toUpperCase())}</option>
			{/each}
		</select>
	</div>

	<div data-testid="permissions-matrix" class="permissions-matrix">
		<table>
			<thead>
				<tr>
					<th>Table / Column</th>
					{#each operations as op}
						<th>{op}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.tables as tableRow}
					<tr data-testid="perm-table-{tableRow.table}" class="table-row">
						<td>
							<button
								data-testid="expand-table-{tableRow.table}"
								class="expand-btn"
								onclick={() => toggleExpand(tableRow.table)}
							>
								{expandedTables.has(tableRow.table) ? '▼' : '▶'}
							</button>
							<strong>{tableRow.table}</strong>
						</td>
						{#each operations as op}
							<td>
								<input
									type="checkbox"
									data-testid="perm-toggle-{tableRow.table}-{op}"
									checked={tableRow.operations[op]}
									disabled={!tableRow.operations[op] && !isOverridden(tableRow.table, undefined, op)}
									onchange={() =>
										handleToggle(tableRow.table, undefined, op, tableRow.operations[op], true)}
								/>
							</td>
						{/each}
					</tr>
					{#if expandedTables.has(tableRow.table)}
						{#each tableRow.columns as colRow}
							<tr class="column-row">
								<td class="column-name">&nbsp;&nbsp;&nbsp;&nbsp;{colRow.column}</td>
								{#each operations as op}
									<td>
										<input
											type="checkbox"
											data-testid="perm-toggle-{tableRow.table}-{colRow.column}-{op}"
											checked={colRow.operations[op]}
											disabled={!colRow.ceiling[op]}
											onchange={() =>
												handleToggle(
													tableRow.table,
													colRow.column,
													op,
													colRow.operations[op],
													colRow.ceiling[op],
												)}
										/>
									</td>
								{/each}
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
