<script lang="ts">
  import type { ColumnMeta } from '@simplicity-admin/core';
  import { getDisplayFormatter } from './field-map.js';

  interface Props {
    columns: ColumnMeta[];
    rows: Record<string, unknown>[];
    totalCount: number;
    page: number;
    pageSize: number;
    sort?: { column: string; direction: 'asc' | 'desc' };
    onSort?: (column: string, direction: 'asc' | 'desc') => void;
    onPageChange?: (page: number) => void;
    onRowClick?: (row: Record<string, unknown>) => void;
  }

  let {
    columns,
    rows,
    totalCount,
    page,
    pageSize,
    sort,
    onSort,
    onPageChange,
    onRowClick,
  }: Props = $props();

  let internalSort: { column: string; direction: 'asc' | 'desc' } | undefined = $state(undefined);

  $effect(() => {
    if (sort) internalSort = sort;
  });

  function humanize(name: string): string {
    return name
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function handleSort(columnName: string) {
    let direction: 'asc' | 'desc' = 'asc';
    if (internalSort?.column === columnName && internalSort.direction === 'asc') {
      direction = 'desc';
    }
    internalSort = { column: columnName, direction };
    onSort?.(columnName, direction);
  }

  function handleRowClick(row: Record<string, unknown>) {
    onRowClick?.(row);
  }

  function handlePageChange(newPage: number) {
    onPageChange?.(newPage);
  }

  const formatters = $derived(
    columns.map((col) => getDisplayFormatter(col))
  );

  const isEmpty = $derived(rows.length === 0 && totalCount === 0);
  const rangeStart = $derived((page - 1) * pageSize + 1);
  const rangeEnd = $derived(Math.min(page * pageSize, totalCount));
  const totalPages = $derived(Math.ceil(totalCount / pageSize));
  const hasPrev = $derived(page > 1);
  const hasNext = $derived(page < totalPages);
</script>

<table class="data-table">
  <thead>
    <tr>
      {#each columns as col}
        <th
          class="data-table-header"
          onclick={() => handleSort(col.name)}
        >
          {humanize(col.name)}
          {#if internalSort?.column === col.name}
            <span class="sort-indicator">
              {internalSort.direction === 'asc' ? '▲' : '▼'}
            </span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#if isEmpty}
      <tr>
        <td class="data-table-empty" colspan={columns.length}>
          No records found
        </td>
      </tr>
    {:else}
      {#each rows as row}
        <tr
          class="data-table-row"
          onclick={() => handleRowClick(row)}
          tabindex="0"
        >
          {#each columns as col, i}
            <td class="data-table-cell">
              {formatters[i](row[col.name])}
            </td>
          {/each}
        </tr>
      {/each}
    {/if}
  </tbody>
</table>

{#if !isEmpty}
  <div class="data-table-pagination">
    <span class="pagination-info">{rangeStart}–{rangeEnd} of {totalCount}</span>
    <button
      class="pagination-btn"
      disabled={!hasPrev}
      onclick={() => handlePageChange(page - 1)}
    >
      Previous
    </button>
    <button
      class="pagination-btn"
      disabled={!hasNext}
      onclick={() => handlePageChange(page + 1)}
    >
      Next
    </button>
  </div>
{/if}
