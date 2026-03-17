import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { jwtTokenProvider } from '@simplicity-admin/auth';
import { securityHeaders } from '$lib/server/security-headers.js';

const tokenProvider = jwtTokenProvider({
	secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET ?? 'development-secret',
});

const auth: Handle = async ({ event, resolve }) => {
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

export const handle = sequence(securityHeaders, auth);
