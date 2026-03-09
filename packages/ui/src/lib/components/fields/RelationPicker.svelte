<script lang="ts">
  interface Props {
    label: string;
    name?: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    placeholder?: string;
  }

  let { label, name, value = $bindable(''), required = false, disabled = false, error, placeholder = 'Select a record…' }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <input
    id={label}
    {name}
    type="text"
    bind:value
    {required}
    {disabled}
    placeholder={placeholder}
    class="field-input"
    class:field-error={!!error}
    aria-invalid={!!error}
  />
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
