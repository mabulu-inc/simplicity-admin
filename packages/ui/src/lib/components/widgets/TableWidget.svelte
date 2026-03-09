<script lang="ts">
	interface Props {
		title: string;
		columns: { key: string; label: string }[];
		rows: Record<string, unknown>[];
		error?: string;
	}

	let { title, columns, rows, error }: Props = $props();
</script>

<div class="table-widget">
	<h3 class="table-widget-title">{title}</h3>
	{#if error}
		<p class="table-widget-error">{error}</p>
	{:else if rows.length === 0}
		<p class="table-widget-empty">No data</p>
	{:else}
		<table class="table-widget-table">
			<thead>
				<tr>
					{#each columns as col}
						<th>{col.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row}
					<tr>
						{#each columns as col}
							<td>{row[col.key] ?? ''}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
