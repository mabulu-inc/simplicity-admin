import type { ColumnMeta } from '@simplicity-admin/core';

export type FieldComponent =
  | 'TextInput' | 'NumberInput' | 'Toggle' | 'Select'
  | 'DatePicker' | 'DateTimePicker' | 'RelationPicker'
  | 'JSONEditor' | 'TagInput' | 'TextArea';

const NUMERIC_TYPES = new Set([
  'integer', 'bigint', 'smallint', 'serial', 'bigserial',
  'numeric', 'decimal', 'real', 'double',
]);

export function getFieldComponent(column: ColumnMeta): FieldComponent {
  const { type, name } = column;

  if (type === 'boolean') return 'Toggle';
  if (type === 'enum') return 'Select';
  if (type === 'date') return 'DatePicker';
  if (type === 'timestamp' || type === 'timestamptz') return 'DateTimePicker';
  if (type === 'json' || type === 'jsonb') return 'JSONEditor';
  if (type === 'array') return 'TagInput';
  if (type === 'text') return 'TextArea';
  if (NUMERIC_TYPES.has(type)) return 'NumberInput';
  if (type === 'uuid' && name.endsWith('_id')) return 'RelationPicker';

  // varchar, char, uuid (non-FK), time, timetz, unknown — all use TextInput
  return 'TextInput';
}

const DATE_TYPES = new Set(['date', 'timestamp', 'timestamptz']);

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDisplayFormatter(column: ColumnMeta): (value: unknown) => string {
  const { type } = column;

  if (type === 'boolean') {
    return (value: unknown) => {
      if (value === null || value === undefined) return '—';
      return value ? '✓' : '✗';
    };
  }

  if (DATE_TYPES.has(type)) {
    return (value: unknown) => {
      if (value === null || value === undefined) return '—';
      const date = new Date(value as string);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };
  }

  if (type === 'enum') {
    return (value: unknown) => {
      if (value === null || value === undefined) return '—';
      return toTitleCase(String(value));
    };
  }

  return (value: unknown) => {
    if (value === null || value === undefined) return '—';
    return String(value);
  };
}
