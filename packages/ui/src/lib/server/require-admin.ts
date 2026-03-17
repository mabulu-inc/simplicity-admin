import { error } from '@sveltejs/kit';

type SessionUser = App.Locals['user'];

/**
 * Require an authenticated admin user. Throws 401 if not authenticated,
 * 403 if the user is not an app_admin and not a super admin.
 * Returns the authenticated user for further use.
 */
export function requireAdmin(user: SessionUser): NonNullable<SessionUser> {
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	if (user.activeRole !== 'app_admin' && !user.superAdmin) {
		throw error(403, 'Admin access required');
	}

	return user;
}
