<script lang="ts">
  interface Props {
    label: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
  }

  let { label, value = $bindable(''), required = false, disabled = false, error }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <textarea
    id={label}
    bind:value
    {required}
    {disabled}
    class="field-input field-json"
    class:field-error={!!error}
    aria-invalid={!!error}
    rows={6}
    spellcheck="false"
  ></textarea>
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
