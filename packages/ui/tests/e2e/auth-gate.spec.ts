import { test, expect } from '@playwright/test';

test.describe('Auth Gate', () => {
	test('unauthenticated user is redirected to login', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/login/);
	});

	test('login page renders email/password form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByTestId('login-page')).toBeVisible();
		await expect(page.getByTestId('login-form')).toBeVisible();
		await expect(page.getByTestId('email-input')).toBeVisible();
		await expect(page.getByTestId('password-input')).toBeVisible();
		await expect(page.getByTestId('login-button')).toBeVisible();
	});

	test('valid login redirects to admin home', async ({ page }) => {
		await page.goto('/login');

		await page.getByTestId('email-input').fill('admin@localhost');
		await page.getByTestId('password-input').fill('changeme');
		await page.getByTestId('login-button').click();

		await expect(page).toHaveURL('/', { timeout: 10_000 });
		await expect(page.getByTestId('admin-home')).toBeVisible();
	});

	test('invalid login shows error message', async ({ page }) => {
		await page.goto('/login');

		await page.getByTestId('email-input').fill('admin@localhost');
		await page.getByTestId('password-input').fill('wrongpassword');
		await page.getByTestId('login-button').click();

		await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('login-error')).toHaveText('Invalid credentials');
	});

	test('authenticated user sees admin shell', async ({ page }) => {
		// Login first
		await page.goto('/login');
		await page.getByTestId('email-input').fill('admin@localhost');
		await page.getByTestId('password-input').fill('changeme');

		// Wait for the login API response, then the session cookie set
		const [loginResponse] = await Promise.all([
			page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200),
			page.getByTestId('login-button').click(),
		]);
		expect(loginResponse.ok()).toBe(true);

		// Wait for the session cookie to be set and navigation to complete
		await page.waitForResponse((res) => res.url().includes('/api/auth/session') && res.status() === 200);
		await page.waitForURL('/', { timeout: 10_000 });

		// Verify shell components are visible
		await expect(page.locator('.shell')).toBeVisible();
		await expect(page.getByTestId('admin-home')).toBeVisible();
	});
});
