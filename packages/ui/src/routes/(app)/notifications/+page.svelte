<script lang="ts">
	import NotificationList from '$lib/components/notifications/NotificationList.svelte';
	import type { Notification } from '@simplicity-admin/core';

	interface NotificationsPageProps {
		data: {
			notifications: Notification[];
			unreadCount: number;
		};
	}

	let { data }: NotificationsPageProps = $props();

	async function handleMarkRead(id: string) {
		const formData = new FormData();
		formData.set('notificationId', id);
		const response = await fetch('?/markRead', { method: 'POST', body: formData });
		if (response.ok) {
			window.location.reload();
		}
	}

	async function handleMarkAllRead() {
		const response = await fetch('?/markAllRead', { method: 'POST' });
		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div data-testid="notifications-page" class="notifications-page">
	<h1>Notifications</h1>

	{#if data.notifications.length === 0}
		<div data-testid="notifications-empty" class="notifications-empty">
			<p>No notifications yet.</p>
		</div>
	{:else}
		<NotificationList
			notifications={data.notifications}
			onMarkRead={handleMarkRead}
			onMarkAllRead={handleMarkAllRead}
		/>
	{/if}
</div>
