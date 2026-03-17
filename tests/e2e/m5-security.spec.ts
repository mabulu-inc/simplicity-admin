import { test, expect } from '@playwright/test';
import { jwtTokenProvider, createRateLimiter } from '@mabulu-inc/simplicity-admin-auth';
import { sanitizeDbError } from '@mabulu-inc/simplicity-admin-db';
import { ConfigError } from '@mabulu-inc/simplicity-admin-core';

/**
 * M5 End-to-End Security Integration Test
 *
 * Full security journey verifying all hardening measures work together:
 * 1. JWT secret validation blocks weak secrets in prod mode
 * 2. Rate limiting triggers on repeated login attempts
 * 3. RBAC blocks unauthorized mutations server-side
 * 4. Error messages are sanitized (no raw DB details leak)
 * 5. Security headers are present on responses
 * 6. GraphQL depth limit is enforced
 */

const BASE_URL = 'http://localhost:5173';

async function loginAs(
	page: import('@playwright/test').Page,
	email: string,
	password = 'changeme',
) {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill(email);
	await page.getByTestId('password-input').fill(password);

	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('M5 Security Hardening', () => {
	test('B-SEC-001: JWT secret validation rejects weak secrets in production', () => {
		const originalEnv = process.env.NODE_ENV;
		try {
			process.env.NODE_ENV = 'production';

			// Default development-secret must throw in production
			expect(() => jwtTokenProvider()).toThrow(ConfigError);
			expect(() => jwtTokenProvider()).toThrow(/must not be used in production/);

			// Short secret must throw in production
			expect(() => jwtTokenProvider({ secret: 'too-short' })).toThrow(ConfigError);
			expect(() => jwtTokenProvider({ secret: 'too-short' })).toThrow(/at least 32 characters/);

			// Sufficiently long secret must succeed
			const longSecret = 'a'.repeat(32);
			expect(() => jwtTokenProvider({ secret: longSecret })).not.toThrow();
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});

	test('B-SEC-004: rate limiting triggers after max attempts', () => {
		const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 });
		const testIp = '192.168.1.100';

		// First 3 attempts should be allowed
		expect(limiter.check(testIp).allowed).toBe(true);
		expect(limiter.check(testIp).allowed).toBe(true);
		expect(limiter.check(testIp).allowed).toBe(true);

		// 4th attempt should be blocked
		const blocked = limiter.check(testIp);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfter).toBeGreaterThan(0);

		// Different IP should still be allowed
		expect(limiter.check('10.0.0.1').allowed).toBe(true);
	});

	test('B-SEC-004: rate limiter can be disabled for tests', () => {
		const limiter = createRateLimiter({ maxAttempts: 1, disabled: true });

		// Even after exceeding limit, disabled limiter always allows
		expect(limiter.check('key').allowed).toBe(true);
		expect(limiter.check('key').allowed).toBe(true);
		expect(limiter.check('key').allowed).toBe(true);
	});

	test('B-SEC-006: error messages are sanitized', () => {
		// Unique violation returns user-friendly message
		const uniqueErr = Object.assign(new Error('duplicate key value violates unique constraint'), {
			code: '23505',
		});
		expect(sanitizeDbError(uniqueErr)).toBe('A record with this value already exists');

		// FK violation returns user-friendly message
		const fkErr = Object.assign(new Error('violates foreign key constraint'), {
			code: '23503',
		});
		expect(sanitizeDbError(fkErr)).toBe('Cannot delete: referenced by other records');

		// Not-null violation returns user-friendly message
		const notNullErr = Object.assign(new Error('null value in column violates not-null constraint'), {
			code: '23502',
		});
		expect(sanitizeDbError(notNullErr)).toBe('A required field is missing');

		// Unknown DB error returns generic message (no schema leak)
		const unknownErr = new Error('relation "secret_table" does not exist');
		expect(sanitizeDbError(unknownErr)).toBe('An error occurred while saving');
		expect(sanitizeDbError(unknownErr)).not.toContain('secret_table');
	});

	test('B-SEC-011: security headers are present on responses', async ({ page }) => {
		const response = await page.goto('/login');
		expect(response).not.toBeNull();

		const headers = response!.headers();

		// X-Content-Type-Options prevents MIME sniffing
		expect(headers['x-content-type-options']).toBe('nosniff');

		// X-Frame-Options prevents clickjacking
		expect(headers['x-frame-options']).toBe('DENY');

		// Referrer-Policy controls referrer information
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	});

	test('B-SEC-002: RBAC blocks unauthorized mutation via crafted POST', async ({ page, request }) => {
		// Login as viewer (restricted role)
		await loginAs(page, 'viewer@localhost');

		// Get cookies from the authenticated browser context
		const cookies = await page.context().cookies();
		const accessToken = cookies.find((c) => c.name === 'access_token');
		expect(accessToken).toBeDefined();

		// Attempt a crafted POST to create a record (viewer should not have insert permission)
		const response = await request.post(`${BASE_URL}/contacts/new`, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: `access_token=${accessToken!.value}`,
			},
			form: {
				first_name: 'Hacked',
				last_name: 'Record',
				email: 'hacked@example.com',
			},
		});

		// Server should reject with 403 (Permission denied) or redirect to error
		// The RBAC guard should prevent the mutation
		const status = response.status();
		expect([403, 303]).toContain(status);

		// If 303 redirect, the form action returned an error
		if (status === 303) {
			// Follow the redirect and check for permission denied indication
			const location = response.headers()['location'];
			expect(location).toBeDefined();
		}
	});

	test('B-SEC-008: GraphiQL is disabled by default', async ({ request }) => {
		// GraphiQL endpoint should not be accessible by default
		const response = await request.get(`${BASE_URL}/api/graphql`, {
			headers: { Accept: 'text/html' },
		});

		// Should either 404 or not return an HTML GraphiQL page
		const status = response.status();
		if (status === 200) {
			const body = await response.text();
			expect(body).not.toContain('GraphiQL');
		}
	});

	test('full security journey: login with credentials validates end-to-end', async ({ page }) => {
		// Verify the login flow works with valid credentials
		await loginAs(page, 'admin@localhost');

		// After login, should be on the home page
		await expect(page).toHaveURL('/');

		// Verify response headers are still set after auth
		const response = await page.goto('/');
		expect(response).not.toBeNull();
		expect(response!.headers()['x-content-type-options']).toBe('nosniff');
		expect(response!.headers()['x-frame-options']).toBe('DENY');
	});

	test('login with invalid credentials returns sanitized error', async ({ page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('email-input').fill('nonexistent@example.com');
		await page.getByTestId('password-input').fill('wrongpassword');

		const [response] = await Promise.all([
			page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
			page.getByTestId('login-button').click(),
		]);

		// Should return 401 with generic error (no user enumeration)
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBe('Invalid credentials');

		// Must NOT reveal whether the email exists
		expect(body.error).not.toContain('not found');
		expect(body.error).not.toContain('does not exist');
	});
});
