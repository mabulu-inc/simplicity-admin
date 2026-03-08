import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { accessToken, refreshToken } = await request.json();

	if (!accessToken) {
		return json({ error: 'Missing access token' }, { status: 400 });
	}

	cookies.set('access_token', accessToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 15, // 15 minutes (matches access token TTL)
	});

	if (refreshToken) {
		cookies.set('refresh_token', refreshToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7, // 7 days (matches refresh token TTL)
		});
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('access_token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
	return json({ ok: true });
};
