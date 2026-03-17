import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/require-admin.js';

type SessionUser = App.Locals['user'];

function makeUser(overrides: Partial<NonNullable<SessionUser>> = {}): NonNullable<SessionUser> {
	return {
		userId: 'u1',
		roles: ['app_admin'],
		activeRole: 'app_admin',
		superAdmin: false,
		...overrides,
	};
}

describe('requireAdmin', () => {
	it('throws 401 when user is undefined', () => {
		try {
			requireAdmin(undefined);
			expect.fail('should have thrown');
		} catch (err) {
			expect(isHttpError(err, 401)).toBe(true);
		}
	});

	it('throws 403 when user is not an admin and not a super admin', () => {
		const user = makeUser({ activeRole: 'app_viewer', superAdmin: false });
		try {
			requireAdmin(user);
			expect.fail('should have thrown');
		} catch (err) {
			expect(isHttpError(err, 403)).toBe(true);
		}
	});

	it('throws 403 for app_editor role without super admin', () => {
		const user = makeUser({ activeRole: 'app_editor', superAdmin: false });
		try {
			requireAdmin(user);
			expect.fail('should have thrown');
		} catch (err) {
			expect(isHttpError(err, 403)).toBe(true);
		}
	});

	it('returns the user when activeRole is app_admin', () => {
		const user = makeUser({ activeRole: 'app_admin', superAdmin: false });
		const result = requireAdmin(user);
		expect(result).toBe(user);
	});

	it('returns the user when superAdmin is true regardless of role', () => {
		const user = makeUser({ activeRole: 'app_viewer', superAdmin: true });
		const result = requireAdmin(user);
		expect(result).toBe(user);
	});

	it('returns the authenticated user object for further use', () => {
		const user = makeUser({ userId: 'admin-42', email: 'admin@test.com' });
		const result = requireAdmin(user);
		expect(result.userId).toBe('admin-42');
		expect(result.email).toBe('admin@test.com');
	});
});
