<script lang="ts">
  import type { ColumnMeta } from '@simplicity-admin/core';
  import { getFieldComponent } from './field-map.js';
  import TextInput from './fields/TextInput.svelte';
  import NumberInput from './fields/NumberInput.svelte';
  import Toggle from './fields/Toggle.svelte';
  import Select from './fields/Select.svelte';
  import DatePicker from './fields/DatePicker.svelte';
  import DateTimePicker from './fields/DateTimePicker.svelte';
  import RelationPicker from './fields/RelationPicker.svelte';
  import JSONEditor from './fields/JSONEditor.svelte';
  import TagInput from './fields/TagInput.svelte';
  import TextArea from './fields/TextArea.svelte';

  interface Props {
    columns: ColumnMeta[];
    values?: Record<string, unknown>;
    readOnlyColumns?: string[];
    hiddenColumns?: string[];
    actions?: Array<{ name: string; label: string; variant?: string; placement: string[] }>;
    onSubmit?: (data: Record<string, unknown>) => void;
    onDelete?: () => void;
    onAction?: (action: string) => void;
  }

  let {
    columns,
    values,
    readOnlyColumns = [],
    hiddenColumns = [],
    actions,
    onSubmit,
    onDelete,
    onAction,
  }: Props = $props();

  const isEditMode = $derived(values !== undefined);

  function humanize(name: string): string {
    return name
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Filter columns based on mode
  const visibleColumns = $derived(
    columns.filter((col) => {
      // Hidden columns are never shown
      if (hiddenColumns.includes(col.name)) return false;

      // In create mode, hide PK columns and columns with defaults or generated
      if (!isEditMode) {
        if (col.hasDefault || col.isGenerated) return false;
      }

      return true;
    }),
  );

  const readOnlySet = $derived(new Set(readOnlyColumns));

  function initFormData(cols: ColumnMeta[], vals?: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      cols.map((col) => [
        col.name,
        vals && col.name in vals
          ? vals[col.name]
          : col.type === 'boolean' ? false : col.type === 'array' ? [] : '',
      ]),
    );
  }

  let formData: Record<string, unknown> = $state(initFormData(columns, values));

  // Validation errors
  let errors: Record<string, string> = $state({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    for (const col of visibleColumns) {
      if (!col.nullable && !col.hasDefault) {
        const val = formData[col.name];
        if (val === '' || val === null || val === undefined) {
          newErrors[col.name] = 'This field is required';
        }
      }
    }
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit?.(formData);
  }
</script>

<form class="auto-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  <div class="auto-form-header">
    {#if onDelete}
      <button type="button" class="btn btn-danger" onclick={() => onDelete?.()}>
        Delete
      </button>
    {/if}
  </div>

  <div class="auto-form-fields">
    {#each visibleColumns as col (col.name)}
      {@const fieldType = getFieldComponent(col)}
      {@const label = humanize(col.name)}
      {@const disabled = readOnlySet.has(col.name)}
      {@const error = errors[col.name]}

      {#if fieldType === 'TextInput'}
        <TextInput
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {:else if fieldType === 'NumberInput'}
        <NumberInput
          {label}
          name={col.name}
          bind:value={formData[col.name] as number}
          {disabled}
          {error}
        />
      {:else if fieldType === 'Toggle'}
        <Toggle
          {label}
          name={col.name}
          bind:value={formData[col.name] as boolean}
          {disabled}
          {error}
        />
      {:else if fieldType === 'Select'}
        <Select
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          options={col.enumValues ?? []}
          {disabled}
          {error}
        />
      {:else if fieldType === 'DatePicker'}
        <DatePicker
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {:else if fieldType === 'DateTimePicker'}
        <DateTimePicker
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {:else if fieldType === 'RelationPicker'}
        <RelationPicker
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {:else if fieldType === 'JSONEditor'}
        <JSONEditor
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {:else if fieldType === 'TagInput'}
        <TagInput
          {label}
          name={col.name}
          bind:value={formData[col.name] as string[]}
          {disabled}
          {error}
        />
      {:else if fieldType === 'TextArea'}
        <TextArea
          {label}
          name={col.name}
          bind:value={formData[col.name] as string}
          {disabled}
          {error}
        />
      {/if}
    {/each}
  </div>

  <div class="auto-form-actions">
    <button type="submit" class="btn btn-primary">Save</button>
  </div>
</form>
