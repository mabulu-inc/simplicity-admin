<script lang="ts">
	import type { Notification } from '@mabulu-inc/simplicity-admin-core';

	interface NotificationListProps {
		notifications: Notification[];
		onMarkRead?: (id: string) => void;
		onMarkAllRead?: () => void;
	}

	let { notifications, onMarkRead, onMarkAllRead }: NotificationListProps = $props();

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleString();
	}
</script>

<div data-testid="notification-list" class="notification-list">
	{#if onMarkAllRead && notifications.some((n) => !n.read)}
		<div class="notification-list-header">
			<button
				data-testid="mark-all-read-button"
				class="mark-all-read-btn"
				onclick={() => onMarkAllRead?.()}
			>
				Mark all as read
			</button>
		</div>
	{/if}

	{#each notifications as notification}
		<div
			data-testid="notification-item-{notification.id}"
			class="notification-item"
			class:unread={!notification.read}
		>
			<div class="notification-content">
				<strong class="notification-subject">{notification.subject}</strong>
				<p class="notification-body">{notification.body}</p>
				<span class="notification-time">{formatDate(notification.createdAt)}</span>
			</div>
			{#if !notification.read && onMarkRead}
				<button
					data-testid="mark-read-button"
					class="mark-read-btn"
					onclick={() => onMarkRead?.(notification.id)}
				>
					Mark read
				</button>
			{/if}
		</div>
	{/each}
</div>
