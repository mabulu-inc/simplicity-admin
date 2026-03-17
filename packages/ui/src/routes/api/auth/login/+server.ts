import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcrypt';
import { jwtTokenProvider, verifyPassword } from '@mabulu-inc/simplicity-admin-auth';
import { createPool } from '@mabulu-inc/simplicity-admin-db';

/**
 * Pre-computed bcrypt hash used for dummy comparisons when the user is not found.
 * This ensures constant-time responses regardless of user existence (B-SEC-009).
 */
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lg2VBe6iXHklLeh1HEVGvSHFPvl7JJHvOzHBsR1tK7X5e';

const ROLE_PRIORITY: Record<string, number> = {
	app_admin: 3,
	app_editor: 2,
	app_viewer: 1,
};

export const POST: RequestHandler = async ({ request }) => {
	const { strategy, email, password } = await request.json();

	if (strategy !== 'password') {
		return json({ error: `Strategy '${strategy ?? 'undefined'}' is not available` }, { status: 400 });
	}

	if (!email || !password) {
		return json({ error: 'Email and password are required' }, { status: 400 });
	}

	const dbUrl = process.env.SIMPLICITY_ADMIN_DATABASE ?? 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';
	const schema = process.env.SIMPLICITY_ADMIN_SCHEMA ?? 'simplicity_admin';
	const pool = createPool(dbUrl);

	try {
		const userResult = await pool.query<{
			id: string;
			email: string;
			password_hash: string;
			super_admin: boolean;
		}>(
			`SELECT id, email, password_hash, super_admin FROM "${schema}".users WHERE email = $1 AND active = true`,
			[email],
		);

		if (userResult.rows.length === 0) {
			// B-SEC-009: Run dummy bcrypt to prevent timing-based user enumeration
			await bcrypt.compare(password, DUMMY_HASH);
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const user = userResult.rows[0];
		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const memberships = await pool.query<{ tenant_id: string; role: string }>(
			`SELECT tenant_id, role FROM "${schema}".memberships WHERE user_id = $1`,
			[user.id],
		);

		let tenantId: string | undefined;
		let roles: string[] = [];

		if (user.super_admin) {
			roles = ['app_admin'];
			if (memberships.rows.length > 0) {
				tenantId = memberships.rows[0].tenant_id;
			} else {
				const defaultTenant = await pool.query<{ id: string }>(
					`SELECT id FROM "${schema}".tenants WHERE slug = 'default' LIMIT 1`,
				);
				if (defaultTenant.rows.length > 0) {
					tenantId = defaultTenant.rows[0].id;
				}
			}
		} else {
			if (memberships.rows.length === 0) {
				return json({ error: 'Invalid credentials' }, { status: 401 });
			}
			tenantId = memberships.rows[0].tenant_id;
			roles = memberships.rows
				.filter((m) => m.tenant_id === tenantId)
				.map((m) => m.role);
		}

		const activeRole = roles.sort(
			(a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0),
		)[0];

		const tokenProvider = jwtTokenProvider({
			secret: process.env.SIMPLICITY_ADMIN_AUTH_SECRET ?? 'development-secret',
		});

		const payload = {
			userId: user.id,
			tenantId,
			roles,
			activeRole,
			superAdmin: user.super_admin,
			authStrategy: 'password',
		};

		const tempToken = await tokenProvider.sign(payload);
		const pair = await tokenProvider.refresh(tempToken);

		return json({
			accessToken: pair.accessToken,
			refreshToken: pair.refreshToken,
		});
	} finally {
		await pool.end();
	}
};
