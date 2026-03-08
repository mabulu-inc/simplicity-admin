<script lang="ts">
  interface Props {
    label: string;
    value: boolean;
    required?: boolean;
    disabled?: boolean;
    error?: string;
  }

  let { label, value = $bindable(false), required = false, disabled = false, error }: Props = $props();
</script>

<div class="field">
  <label class="field-label">
    <input
      type="checkbox"
      bind:checked={value}
      {required}
      {disabled}
      class="field-toggle"
      aria-label={label}
      aria-invalid={!!error}
    />
    {label}
  </label>
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
