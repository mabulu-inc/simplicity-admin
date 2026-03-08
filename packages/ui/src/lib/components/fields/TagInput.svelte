<script lang="ts">
  interface Props {
    label: string;
    value: string[];
    required?: boolean;
    disabled?: boolean;
    error?: string;
  }

  let { label, value = $bindable([]), required = false, disabled = false, error }: Props = $props();

  let inputValue = $state('');

  function addTag() {
    const tag = inputValue.trim();
    if (tag && !value.includes(tag)) {
      value = [...value, tag];
    }
    inputValue = '';
  }

  function removeTag(tag: string) {
    value = value.filter((t) => t !== tag);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }
</script>

<div class="field">
  <label class="field-label" for={label}>{label}</label>
  <div class="field-tags">
    {#each value as tag}
      <span class="tag">
        {tag}
        {#if !disabled}
          <button type="button" class="tag-remove" onclick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>×</button>
        {/if}
      </span>
    {/each}
    <input
      id={label}
      type="text"
      bind:value={inputValue}
      {disabled}
      class="field-tag-input"
      placeholder="Add tag…"
      onkeydown={handleKeyDown}
      aria-label={label}
    />
  </div>
  {#if error}
    <span class="field-error-message">{error}</span>
  {/if}
</div>
