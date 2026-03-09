<script lang="ts">
  interface Props {
    label: string;
    name?: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
  }

  let { label, name, value = $bindable(''), required = false, disabled = false, error }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <input
    id={label}
    {name}
    type="date"
    bind:value
    {required}
    {disabled}
    class="field-input"
    class:field-error={!!error}
    aria-invalid={!!error}
  />
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
