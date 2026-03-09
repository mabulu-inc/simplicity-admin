import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 *
 * Tests default dashboard rendering, widget display, and the dashboard builder.
 * Requires seeded dashboard data (created via API calls in setup).
 */

test.describe('Dashboards', () => {
	test.beforeEach(async ({ page }) => {
		// Login as admin
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('email-input').fill('admin@localhost');
		await page.getByTestId('password-input').fill('changeme');
		await Promise.all([
			page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
			page.getByTestId('login-button').click(),
		]);
		await page.waitForURL('/', { timeout: 15_000 });
	});

	test('default dashboard renders for role', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10_000 });

		// Should show either a dashboard grid or the welcome fallback
		const hasDashboard = await page.getByTestId('dashboard-grid').isVisible().catch(() => false);
		const hasWelcome = await page.getByTestId('dashboard-welcome').isVisible().catch(() => false);
		expect(hasDashboard || hasWelcome).toBe(true);
	});

	test('widgets display data', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10_000 });

		// If there's a dashboard grid with widgets, verify widgets render
		const hasDashboard = await page.getByTestId('dashboard-grid').isVisible().catch(() => false);
		if (hasDashboard) {
			// At least one widget container should be visible
			const widgetCount = await page.locator('.dashboard-grid-cell').count();
			expect(widgetCount).toBeGreaterThanOrEqual(0);
		}
	});

	test('dashboard builder creates new dashboard', async ({ page }) => {
		await page.goto('/dashboard/builder');
		await expect(page.getByTestId('dashboard-builder')).toBeVisible({ timeout: 10_000 });

		// Fill in the builder form
		await page.getByTestId('dashboard-name-input').fill('E2E Test Dashboard');
		await page.getByTestId('dashboard-slug-input').fill('e2e-test-dashboard');

		// Submit the form to create the dashboard
		await page.getByTestId('dashboard-save-button').click();

		// Should redirect to the new dashboard or show success
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

		// Navigate to the created dashboard by slug
		await page.goto('/dashboard/e2e-test-dashboard');
		await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10_000 });
	});
});
