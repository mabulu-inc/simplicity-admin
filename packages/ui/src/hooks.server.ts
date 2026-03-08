import type { Handle } from '@sveltejs/kit';
import { jwtTokenProvider } from '@simplicity-admin/auth';

const tokenProvider = jwtTokenProvider({
	secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET ?? 'development-secret',
});

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('access_token');

	if (token) {
		try {
			const payload = await tokenProvider.verify(token);
			event.locals.user = {
				userId: payload.userId,
				tenantId: payload.tenantId,
				roles: payload.roles,
				activeRole: payload.activeRole,
				superAdmin: payload.superAdmin ?? false,
			};
		} catch {
			event.cookies.delete('access_token', { path: '/' });
		}
	}

	return resolve(event);
};
