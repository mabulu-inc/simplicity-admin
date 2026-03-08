<script lang="ts">
  interface Props {
    label: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    placeholder?: string;
  }

  let { label, value = $bindable(''), required = false, disabled = false, error, placeholder }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <input
    id={label}
    type="text"
    bind:value
    {required}
    {disabled}
    {placeholder}
    class="field-input"
    class:field-error={!!error}
    aria-invalid={!!error}
  />
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
