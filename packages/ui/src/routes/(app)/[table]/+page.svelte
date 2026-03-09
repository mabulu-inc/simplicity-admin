<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	function humanize(name: string): string {
		return name
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	function buildUrl(params: Record<string, string | undefined>): string {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) {
				url.searchParams.set(key, value);
			} else {
				url.searchParams.delete(key);
			}
		}
		return url.pathname + url.search;
	}

	function handleSort(column: string, direction: 'asc' | 'desc') {
		goto(buildUrl({ sort: column, dir: direction, page: '1' }));
	}

	function handlePageChange(newPage: number) {
		goto(buildUrl({ page: String(newPage) }));
	}

	function handleRowClick(row: Record<string, unknown>) {
		const pk = data.table.primaryKey[0];
		if (pk && row[pk] != null) {
			goto(`/${data.table.name}/${row[pk]}`);
		}
	}
</script>

<div data-testid="list-view">
	<div class="list-view-header">
		<h1 data-testid="list-view-title">{humanize(data.table.name)}</h1>
		{#if data.canInsert}
			<a href="/{data.table.name}/new" class="btn btn-primary" data-testid="create-button">
				Create
			</a>
		{/if}
	</div>

	{#if data.totalCount === 0 && data.rows.length === 0}
		<div class="empty-state" data-testid="empty-state">
			<p>No records yet</p>
			<a href="/{data.table.name}/new" class="btn btn-primary">Create</a>
		</div>
	{:else}
		<DataTable
			columns={data.table.columns}
			rows={data.rows}
			totalCount={data.totalCount}
			page={data.page}
			pageSize={data.pageSize}
			sort={data.sort}
			onSort={handleSort}
			onPageChange={handlePageChange}
			onRowClick={handleRowClick}
		/>
	{/if}
</div>

<style>
	.list-view-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.list-view-header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: #6b7280;
	}

	.empty-state p {
		font-size: 1.125rem;
		margin-bottom: 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}
</style>
