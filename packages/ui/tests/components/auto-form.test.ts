import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import type { ColumnMeta } from '@simplicity-admin/core';

import AutoForm from '../../src/lib/components/AutoForm.svelte';
import ConfirmDialog from '../../src/lib/components/ConfirmDialog.svelte';
import Toast from '../../src/lib/components/Toast.svelte';

afterEach(() => cleanup());

const textColumn: ColumnMeta = {
  name: 'name',
  type: 'varchar',
  pgType: 'character varying',
  nullable: false,
  hasDefault: false,
  defaultValue: null,
  isPrimaryKey: false,
  isGenerated: false,
  comment: null,
};

const booleanColumn: ColumnMeta = {
  name: 'active',
  type: 'boolean',
  pgType: 'boolean',
  nullable: false,
  hasDefault: false,
  defaultValue: null,
  isPrimaryKey: false,
  isGenerated: false,
  comment: null,
};

const enumColumn: ColumnMeta = {
  name: 'status',
  type: 'enum',
  pgType: 'USER-DEFINED',
  nullable: false,
  hasDefault: false,
  defaultValue: null,
  isPrimaryKey: false,
  isGenerated: false,
  enumValues: ['draft', 'published', 'archived'],
  comment: null,
};

const pkColumn: ColumnMeta = {
  name: 'id',
  type: 'uuid',
  pgType: 'uuid',
  nullable: false,
  hasDefault: true,
  defaultValue: 'gen_random_uuid()',
  isPrimaryKey: true,
  isGenerated: false,
  comment: null,
};

const generatedColumn: ColumnMeta = {
  name: 'created_at',
  type: 'timestamptz',
  pgType: 'timestamp with time zone',
  nullable: false,
  hasDefault: true,
  defaultValue: 'now()',
  isPrimaryKey: false,
  isGenerated: true,
  comment: null,
};

const allColumns: ColumnMeta[] = [pkColumn, textColumn, booleanColumn, enumColumn, generatedColumn];

describe('AutoForm', () => {
  it('generates correct field types from ColumnMeta[]', () => {
    render(AutoForm, { props: { columns: [textColumn, booleanColumn, enumColumn] } });
    // TextInput for varchar
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).type).toBe('text');
    // Toggle for boolean
    expect(screen.getByLabelText('Active')).toBeTruthy();
    expect((screen.getByLabelText('Active') as HTMLInputElement).type).toBe('checkbox');
    // Select for enum
    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('Status').tagName).toBe('SELECT');
  });

  it('populates values in edit mode', () => {
    render(AutoForm, {
      props: {
        columns: [textColumn, booleanColumn],
        values: { name: 'Alice', active: true },
      },
    });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Alice');
    expect((screen.getByLabelText('Active') as HTMLInputElement).checked).toBe(true);
  });

  it('validates required fields on submit', async () => {
    const onSubmit = vi.fn();
    render(AutoForm, {
      props: {
        columns: [textColumn],
        onSubmit,
      },
    });
    const saveButton = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveButton);
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides PK and generated columns in create mode', () => {
    render(AutoForm, { props: { columns: allColumns } });
    // PK (id) has hasDefault:true — hidden in create mode
    expect(screen.queryByLabelText('Id')).toBeNull();
    // Generated column (created_at) — hidden in create mode
    expect(screen.queryByLabelText('Created At')).toBeNull();
    // Regular columns still visible
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Active')).toBeTruthy();
    expect(screen.getByLabelText('Status')).toBeTruthy();
  });

  it('respects readOnlyColumns in edit mode', () => {
    render(AutoForm, {
      props: {
        columns: allColumns,
        values: { id: '123', name: 'Alice', active: true, status: 'draft', created_at: '2024-01-01' },
        readOnlyColumns: ['created_at'],
      },
    });
    // created_at should be rendered but disabled
    const createdAtField = screen.getByLabelText('Created At');
    expect(createdAtField).toBeTruthy();
    expect((createdAtField as HTMLInputElement).disabled).toBe(true);
  });

  it('calls onSubmit with form data on save', async () => {
    const onSubmit = vi.fn();
    render(AutoForm, {
      props: {
        columns: [textColumn, booleanColumn],
        values: { name: 'Bob', active: false },
        onSubmit,
      },
    });
    const saveButton = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveButton);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bob', active: false }),
    );
  });

  it('shows delete button when onDelete is provided', () => {
    const onDelete = vi.fn();
    render(AutoForm, {
      props: {
        columns: [textColumn],
        values: { name: 'Alice' },
        onDelete,
      },
    });
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('hides delete button when onDelete is not provided', () => {
    render(AutoForm, {
      props: {
        columns: [textColumn],
        values: { name: 'Alice' },
      },
    });
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  it('renders with title and message', () => {
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete Record',
        message: 'Are you sure?',
      },
    });
    expect(screen.getByText('Delete Record')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete',
        message: 'Sure?',
        onConfirm,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete',
        message: 'Sure?',
        onCancel,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('is not visible when open is false', () => {
    render(ConfirmDialog, {
      props: {
        open: false,
        title: 'Delete',
        message: 'Sure?',
      },
    });
    expect(screen.queryByText('Delete')).toBeNull();
  });
});

describe('Toast', () => {
  it('renders with message and type', () => {
    render(Toast, {
      props: {
        message: 'Record saved',
        type: 'success',
        visible: true,
      },
    });
    expect(screen.getByText('Record saved')).toBeTruthy();
  });

  it('is not visible when visible is false', () => {
    render(Toast, {
      props: {
        message: 'Record saved',
        type: 'success',
        visible: false,
      },
    });
    expect(screen.queryByText('Record saved')).toBeNull();
  });

  it('renders error type', () => {
    render(Toast, {
      props: {
        message: 'Something went wrong',
        type: 'error',
        visible: true,
      },
    });
    const toast = screen.getByText('Something went wrong');
    expect(toast.closest('.toast-error')).toBeTruthy();
  });
});
