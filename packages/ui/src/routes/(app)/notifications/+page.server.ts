import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db.js';
import { NotificationEngine } from '@simplicity-admin/core';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const pool = getPool();
	const engine = new NotificationEngine(pool);

	const notifications = await engine.getUnread(locals.user.userId);

	// Also get read notifications for the full list
	const allResult = await pool.query(
		'SELECT * FROM simplicity_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
		[locals.user.userId],
	);

	return {
		notifications: allResult.rows,
		unreadCount: notifications.length,
	};
};

export const actions: Actions = {
	markRead: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const notificationId = formData.get('notificationId') as string;
		if (!notificationId) {
			throw error(400, 'Missing notificationId');
		}

		const pool = getPool();
		const engine = new NotificationEngine(pool);
		await engine.markRead(notificationId);

		return { success: true };
	},

	markAllRead: async ({ locals }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}

		const pool = getPool();
		const engine = new NotificationEngine(pool);
		await engine.markAllRead(locals.user.userId);

		return { success: true };
	},
};
