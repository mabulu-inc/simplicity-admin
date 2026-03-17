import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getSchemaMeta, getPool, SCHEMA } from '$lib/server/db.js';
import { getEffectivePermissions, listOverrides, mergeOverrides } from '@mabulu-inc/simplicity-admin-auth';
import { NotificationEngine } from '@mabulu-inc/simplicity-admin-core';
import { buildNavItems } from '$lib/nav/builder.js';
import type { NavItem } from '$lib/nav/types.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const role = locals.user.activeRole;
	let navItems: NavItem[] = [];
	let unreadCount = 0;

	try {
		const [meta, pool] = await Promise.all([getSchemaMeta(), Promise.resolve(getPool())]);
		const codePerms = await getEffectivePermissions(pool, role, SCHEMA);
		const overrides = await listOverrides(pool, role);
		const perms = mergeOverrides(codePerms, overrides);
		navItems = buildNavItems(meta, undefined, perms, '');

		const engine = new NotificationEngine(pool);
		const unread = await engine.getUnread(locals.user.userId);
		unreadCount = unread.length;
	} catch {
		// If schema introspection or permissions fail, return empty nav
		// rather than breaking the entire layout
		navItems = [];
	}

	return {
		user: locals.user,
		navItems,
		currentPath: url.pathname,
		unreadCount,
	};
};
