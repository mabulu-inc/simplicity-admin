<script lang="ts">
  interface Props {
    label: string;
    name?: string;
    value: number | null;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    step?: number | string;
  }

  let { label, name, value = $bindable(null), required = false, disabled = false, error, step }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <input
    id={label}
    {name}
    type="number"
    bind:value
    {required}
    {disabled}
    {step}
    class="field-input"
    class:field-error={!!error}
    aria-invalid={!!error}
  />
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
