import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import DataTable from '../../src/lib/components/DataTable.svelte';
import type { ColumnMeta } from '@mabulu-inc/simplicity-admin-core';

afterEach(() => cleanup());

function col(overrides: Partial<ColumnMeta> & { name: string }): ColumnMeta {
  return {
    type: 'varchar',
    pgType: 'character varying',
    nullable: true,
    hasDefault: false,
    defaultValue: null,
    isPrimaryKey: false,
    isGenerated: false,
    comment: null,
    ...overrides,
  };
}

const columns: ColumnMeta[] = [
  col({ name: 'id', type: 'integer', pgType: 'integer', isPrimaryKey: true }),
  col({ name: 'name', type: 'varchar', pgType: 'character varying' }),
  col({ name: 'email', type: 'varchar', pgType: 'character varying' }),
];

describe('DataTable', () => {
  it('renders column headers from ColumnMeta[]', () => {
    render(DataTable, {
      props: {
        columns,
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('Id')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders rows with formatted values', () => {
    const rows = [
      { id: 1, name: 'Alice', email: 'alice@ex.com' },
      { id: 2, name: 'Bob', email: 'bob@ex.com' },
    ];

    render(DataTable, {
      props: {
        columns,
        rows,
        totalCount: 2,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('bob@ex.com')).toBeTruthy();
  });

  it('sort click dispatches event with column + direction', async () => {
    const onSort = vi.fn();

    render(DataTable, {
      props: {
        columns,
        rows: [{ id: 1, name: 'Alice', email: 'a@b.com' }],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        onSort,
      },
    });

    const nameHeader = screen.getByText('Name');
    await fireEvent.click(nameHeader);
    expect(onSort).toHaveBeenCalledWith('name', 'asc');

    await fireEvent.click(nameHeader);
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('pagination renders correct info ("1-25 of 50")', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@ex.com`,
    }));

    render(DataTable, {
      props: {
        columns,
        rows,
        totalCount: 50,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('1–25 of 50')).toBeTruthy();
  });

  it('empty state shows "No records found"', () => {
    render(DataTable, {
      props: {
        columns,
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('No records found')).toBeTruthy();
  });

  it('boolean columns show checkmark/x', () => {
    const boolColumns: ColumnMeta[] = [
      col({ name: 'active', type: 'boolean', pgType: 'boolean' }),
    ];

    render(DataTable, {
      props: {
        columns: boolColumns,
        rows: [{ active: true }, { active: false }],
        totalCount: 2,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('date columns show formatted dates', () => {
    const dateColumns: ColumnMeta[] = [
      col({ name: 'created_at', type: 'timestamptz', pgType: 'timestamp with time zone' }),
    ];

    render(DataTable, {
      props: {
        columns: dateColumns,
        rows: [{ created_at: '2024-03-15T10:30:00Z' }],
        totalCount: 1,
        page: 1,
        pageSize: 25,
      },
    });

    expect(screen.getByText('Mar 15, 2024')).toBeTruthy();
  });
});
