<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }

  let { open, title, message, onConfirm, onCancel }: Props = $props();
</script>

{#if open}
  <div class="confirm-dialog-overlay" role="dialog" aria-modal="true">
    <div class="confirm-dialog">
      <h3 class="confirm-dialog-title">{title}</h3>
      <p class="confirm-dialog-message">{message}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="btn" onclick={() => onCancel?.()}>Cancel</button>
        <button type="button" class="btn btn-danger" onclick={() => onConfirm?.()}>Confirm</button>
      </div>
    </div>
  </div>
{/if}
