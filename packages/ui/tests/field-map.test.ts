import { describe, it, expect } from 'vitest';
import type { ColumnMeta } from '@simplicity-admin/core';
import { getFieldComponent, getDisplayFormatter } from '../src/lib/components/field-map.js';
import type { FieldComponent } from '../src/lib/components/field-map.js';

function col(overrides: Partial<ColumnMeta> & { name: string; type: ColumnMeta['type'] }): ColumnMeta {
  return {
    pgType: overrides.type,
    nullable: true,
    hasDefault: false,
    defaultValue: null,
    isPrimaryKey: false,
    isGenerated: false,
    comment: null,
    ...overrides,
  };
}

describe('getFieldComponent', () => {
  const cases: Array<[string, Partial<ColumnMeta> & { name: string; type: ColumnMeta['type'] }, FieldComponent]> = [
    ['text → TextArea', { name: 'bio', type: 'text' }, 'TextArea'],
    ['varchar → TextInput', { name: 'name', type: 'varchar' }, 'TextInput'],
    ['char → TextInput', { name: 'code', type: 'char' }, 'TextInput'],
    ['integer → NumberInput', { name: 'age', type: 'integer' }, 'NumberInput'],
    ['bigint → NumberInput', { name: 'count', type: 'bigint' }, 'NumberInput'],
    ['smallint → NumberInput', { name: 'rank', type: 'smallint' }, 'NumberInput'],
    ['serial → NumberInput', { name: 'seq', type: 'serial' }, 'NumberInput'],
    ['bigserial → NumberInput', { name: 'big_seq', type: 'bigserial' }, 'NumberInput'],
    ['numeric → NumberInput', { name: 'price', type: 'numeric' }, 'NumberInput'],
    ['decimal → NumberInput', { name: 'amount', type: 'decimal' }, 'NumberInput'],
    ['real → NumberInput', { name: 'rate', type: 'real' }, 'NumberInput'],
    ['double → NumberInput', { name: 'precise', type: 'double' }, 'NumberInput'],
    ['boolean → Toggle', { name: 'active', type: 'boolean' }, 'Toggle'],
    ['enum → Select', { name: 'status', type: 'enum', enumValues: ['draft', 'published'] }, 'Select'],
    ['date → DatePicker', { name: 'birth_date', type: 'date' }, 'DatePicker'],
    ['timestamp → DateTimePicker', { name: 'created_at', type: 'timestamp' }, 'DateTimePicker'],
    ['timestamptz → DateTimePicker', { name: 'updated_at', type: 'timestamptz' }, 'DateTimePicker'],
    ['time → TextInput', { name: 'start_time', type: 'time' }, 'TextInput'],
    ['timetz → TextInput', { name: 'end_time', type: 'timetz' }, 'TextInput'],
    ['uuid (plain) → TextInput', { name: 'id', type: 'uuid' }, 'TextInput'],
    ['uuid (FK _id suffix) → RelationPicker', { name: 'tenant_id', type: 'uuid' }, 'RelationPicker'],
    ['json → JSONEditor', { name: 'data', type: 'json' }, 'JSONEditor'],
    ['jsonb → JSONEditor', { name: 'metadata', type: 'jsonb' }, 'JSONEditor'],
    ['array → TagInput', { name: 'tags', type: 'array' }, 'TagInput'],
    ['unknown → TextInput (fallback)', { name: 'weird', type: 'unknown' }, 'TextInput'],
  ];

  for (const [label, input, expected] of cases) {
    it(`maps ${label}`, () => {
      expect(getFieldComponent(col(input))).toBe(expected);
    });
  }
});

describe('getDisplayFormatter', () => {
  it('formats boolean true as checkmark', () => {
    const fmt = getDisplayFormatter(col({ name: 'active', type: 'boolean' }));
    expect(fmt(true)).toBe('✓');
  });

  it('formats boolean false as x', () => {
    const fmt = getDisplayFormatter(col({ name: 'active', type: 'boolean' }));
    expect(fmt(false)).toBe('✗');
  });

  it('formats null as em dash', () => {
    const fmt = getDisplayFormatter(col({ name: 'name', type: 'varchar' }));
    expect(fmt(null)).toBe('—');
  });

  it('formats undefined as em dash', () => {
    const fmt = getDisplayFormatter(col({ name: 'name', type: 'varchar' }));
    expect(fmt(undefined)).toBe('—');
  });

  it('formats date values as locale string', () => {
    const fmt = getDisplayFormatter(col({ name: 'birth_date', type: 'date' }));
    const result = fmt('2024-03-15');
    // Should produce a human-readable date string
    expect(result).toContain('2024');
    expect(result).not.toBe('2024-03-15'); // Should be formatted, not raw
  });

  it('formats timestamp values as locale string', () => {
    const fmt = getDisplayFormatter(col({ name: 'created_at', type: 'timestamptz' }));
    const result = fmt('2024-03-15T10:30:00Z');
    expect(result).toContain('2024');
  });

  it('formats enum values as title case', () => {
    const fmt = getDisplayFormatter(col({ name: 'status', type: 'enum', enumValues: ['draft', 'published'] }));
    expect(fmt('draft')).toBe('Draft');
    expect(fmt('published')).toBe('Published');
  });

  it('formats multi-word enum values as title case', () => {
    const fmt = getDisplayFormatter(col({ name: 'status', type: 'enum', enumValues: ['in_progress'] }));
    expect(fmt('in_progress')).toBe('In Progress');
  });

  it('formats plain text values as-is', () => {
    const fmt = getDisplayFormatter(col({ name: 'name', type: 'varchar' }));
    expect(fmt('Alice')).toBe('Alice');
  });

  it('formats numbers as string', () => {
    const fmt = getDisplayFormatter(col({ name: 'age', type: 'integer' }));
    expect(fmt(42)).toBe('42');
  });
});
