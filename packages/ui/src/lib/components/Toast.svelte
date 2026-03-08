<script lang="ts">
  interface Props {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    visible: boolean;
    onClose?: () => void;
  }

  let { message, type, visible, onClose }: Props = $props();
</script>

{#if visible}
  <div class="toast toast-{type}" role="alert">
    <span class="toast-message">{message}</span>
    {#if onClose}
      <button type="button" class="toast-close" onclick={() => onClose?.()}>×</button>
    {/if}
  </div>
{/if}
