import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

import TextInput from '../../src/lib/components/fields/TextInput.svelte';
import NumberInput from '../../src/lib/components/fields/NumberInput.svelte';
import Toggle from '../../src/lib/components/fields/Toggle.svelte';
import Select from '../../src/lib/components/fields/Select.svelte';
import DatePicker from '../../src/lib/components/fields/DatePicker.svelte';
import DateTimePicker from '../../src/lib/components/fields/DateTimePicker.svelte';
import RelationPicker from '../../src/lib/components/fields/RelationPicker.svelte';
import JSONEditor from '../../src/lib/components/fields/JSONEditor.svelte';
import TagInput from '../../src/lib/components/fields/TagInput.svelte';
import TextArea from '../../src/lib/components/fields/TextArea.svelte';

afterEach(() => cleanup());

describe('TextInput', () => {
  it('renders with label and value', () => {
    render(TextInput, { props: { label: 'Name', value: 'Alice' } });
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Alice');
  });

  it('binds value on input', async () => {
    const { component } = render(TextInput, { props: { label: 'Name', value: '' } });
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Bob' } });
    expect(input.value).toBe('Bob');
  });

  it('shows required error when required and empty', () => {
    render(TextInput, { props: { label: 'Name', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('renders as disabled when disabled prop is set', () => {
    render(TextInput, { props: { label: 'Name', value: 'Alice', disabled: true } });
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('NumberInput', () => {
  it('renders with label and numeric value', () => {
    render(NumberInput, { props: { label: 'Age', value: 25 } });
    expect(screen.getByLabelText('Age')).toBeTruthy();
    expect((screen.getByLabelText('Age') as HTMLInputElement).value).toBe('25');
  });

  it('binds value on input', async () => {
    render(NumberInput, { props: { label: 'Age', value: 0 } });
    const input = screen.getByLabelText('Age') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
  });

  it('shows required error', () => {
    render(NumberInput, { props: { label: 'Age', value: null, required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('renders with label and checked state', () => {
    render(Toggle, { props: { label: 'Active', value: true } });
    expect(screen.getByLabelText('Active')).toBeTruthy();
    expect((screen.getByLabelText('Active') as HTMLInputElement).checked).toBe(true);
  });

  it('toggles value on click', async () => {
    render(Toggle, { props: { label: 'Active', value: false } });
    const input = screen.getByLabelText('Active') as HTMLInputElement;
    await fireEvent.click(input);
    expect(input.checked).toBe(true);
  });

  it('shows required error', () => {
    render(Toggle, { props: { label: 'Active', value: false, required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('Select', () => {
  it('renders with label and options', () => {
    render(Select, { props: { label: 'Status', value: 'active', options: ['active', 'inactive', 'pending'] } });
    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('active');
  });

  it('binds value on change', async () => {
    render(Select, { props: { label: 'Status', value: 'active', options: ['active', 'inactive'] } });
    const select = screen.getByLabelText('Status') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'inactive' } });
    expect(select.value).toBe('inactive');
  });

  it('shows required error', () => {
    render(Select, { props: { label: 'Status', value: '', options: ['a', 'b'], required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('DatePicker', () => {
  it('renders with label and date value', () => {
    render(DatePicker, { props: { label: 'Birthday', value: '2024-03-15' } });
    expect(screen.getByLabelText('Birthday')).toBeTruthy();
    expect((screen.getByLabelText('Birthday') as HTMLInputElement).value).toBe('2024-03-15');
  });

  it('binds value on change', async () => {
    render(DatePicker, { props: { label: 'Birthday', value: '' } });
    const input = screen.getByLabelText('Birthday') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '2024-06-01' } });
    expect(input.value).toBe('2024-06-01');
  });

  it('shows required error', () => {
    render(DatePicker, { props: { label: 'Birthday', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('DateTimePicker', () => {
  it('renders with label and datetime value', () => {
    render(DateTimePicker, { props: { label: 'Created At', value: '2024-03-15T10:30' } });
    expect(screen.getByLabelText('Created At')).toBeTruthy();
    expect((screen.getByLabelText('Created At') as HTMLInputElement).value).toBe('2024-03-15T10:30');
  });

  it('binds value on change', async () => {
    render(DateTimePicker, { props: { label: 'Created At', value: '' } });
    const input = screen.getByLabelText('Created At') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '2024-06-01T14:00' } });
    expect(input.value).toBe('2024-06-01T14:00');
  });

  it('shows required error', () => {
    render(DateTimePicker, { props: { label: 'Created At', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('RelationPicker', () => {
  it('renders with label and value', () => {
    render(RelationPicker, { props: { label: 'Author', value: 'uuid-123' } });
    expect(screen.getByLabelText('Author')).toBeTruthy();
    expect((screen.getByLabelText('Author') as HTMLInputElement).value).toBe('uuid-123');
  });

  it('binds value on input', async () => {
    render(RelationPicker, { props: { label: 'Author', value: '' } });
    const input = screen.getByLabelText('Author') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'uuid-456' } });
    expect(input.value).toBe('uuid-456');
  });

  it('shows required error', () => {
    render(RelationPicker, { props: { label: 'Author', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('JSONEditor', () => {
  it('renders with label and JSON string value', () => {
    const json = '{"key":"value"}';
    render(JSONEditor, { props: { label: 'Config', value: json } });
    expect(screen.getByLabelText('Config')).toBeTruthy();
    expect((screen.getByLabelText('Config') as HTMLTextAreaElement).value).toBe(json);
  });

  it('binds value on input', async () => {
    render(JSONEditor, { props: { label: 'Config', value: '' } });
    const textarea = screen.getByLabelText('Config') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: '{"a":1}' } });
    expect(textarea.value).toBe('{"a":1}');
  });

  it('shows required error', () => {
    render(JSONEditor, { props: { label: 'Config', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('TagInput', () => {
  it('renders with label and tags', () => {
    render(TagInput, { props: { label: 'Tags', value: ['red', 'blue'] } });
    expect(screen.getByLabelText('Tags')).toBeTruthy();
    expect(screen.getByText('red')).toBeTruthy();
    expect(screen.getByText('blue')).toBeTruthy();
  });

  it('adds a tag on Enter', async () => {
    render(TagInput, { props: { label: 'Tags', value: [] } });
    const input = screen.getByLabelText('Tags') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'green' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('green')).toBeTruthy();
  });

  it('shows required error', () => {
    render(TagInput, { props: { label: 'Tags', value: [], required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('TextArea', () => {
  it('renders with label and value', () => {
    render(TextArea, { props: { label: 'Bio', value: 'Hello world' } });
    expect(screen.getByLabelText('Bio')).toBeTruthy();
    expect((screen.getByLabelText('Bio') as HTMLTextAreaElement).value).toBe('Hello world');
  });

  it('binds value on input', async () => {
    render(TextArea, { props: { label: 'Bio', value: '' } });
    const textarea = screen.getByLabelText('Bio') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'Updated bio' } });
    expect(textarea.value).toBe('Updated bio');
  });

  it('shows required error', () => {
    render(TextArea, { props: { label: 'Bio', value: '', required: true, error: 'This field is required' } });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});
