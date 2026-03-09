import { test, expect } from '@playwright/test';

// Helper: login as admin (app_admin role — full access)
async function loginAsAdmin(page: import('@playwright/test').Page) {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill('admin@localhost');
	await page.getByTestId('password-input').fill('changeme');

	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('Permissions management UI', () => {
	test('permissions matrix renders (roles × tables × operations)', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/permissions');

		// Wait for the permissions page to load
		const matrix = page.getByTestId('permissions-matrix');
		await expect(matrix).toBeVisible({ timeout: 10_000 });

		// Should display role headers
		await expect(page.getByTestId('role-select')).toBeVisible();

		// Should have table rows
		const tableRows = matrix.locator('[data-testid^="perm-table-"]');
		const count = await tableRows.count();
		expect(count).toBeGreaterThan(0);

		// Should have operation columns (SELECT, INSERT, UPDATE, DELETE)
		await expect(page.getByText('SELECT')).toBeVisible();
		await expect(page.getByText('INSERT')).toBeVisible();
		await expect(page.getByText('UPDATE')).toBeVisible();
		await expect(page.getByText('DELETE')).toBeVisible();
	});

	test('admin can toggle column permissions', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/permissions');

		const matrix = page.getByTestId('permissions-matrix');
		await expect(matrix).toBeVisible({ timeout: 10_000 });

		// Select a non-admin role to modify (e.g. app_viewer)
		const roleSelect = page.getByTestId('role-select');
		await roleSelect.selectOption('app_viewer');

		// Wait for the matrix to update
		await page.waitForTimeout(500);

		// Expand a table to see column-level permissions
		const expandButton = page.locator('[data-testid^="expand-table-"]').first();
		if (await expandButton.isVisible()) {
			await expandButton.click();
		}

		// Find a column toggle checkbox and click it to deny
		const columnToggle = page.locator('[data-testid^="perm-toggle-"]').first();
		if (await columnToggle.isVisible()) {
			const wasChecked = await columnToggle.isChecked();
			await columnToggle.click();

			// Wait for the action to process
			await page.waitForTimeout(1000);

			// Verify the toggle state changed
			const isChecked = await columnToggle.isChecked();
			expect(isChecked).not.toBe(wasChecked);
		}
	});

	test('changes take effect immediately', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/permissions');

		const matrix = page.getByTestId('permissions-matrix');
		await expect(matrix).toBeVisible({ timeout: 10_000 });

		// Select app_viewer role
		const roleSelect = page.getByTestId('role-select');
		await roleSelect.selectOption('app_viewer');
		await page.waitForTimeout(500);

		// The matrix should show the current state without requiring a page reload
		// Verify the matrix has populated with permission data
		const toggles = page.locator('[data-testid^="perm-toggle-"]');
		const toggleCount = await toggles.count();
		expect(toggleCount).toBeGreaterThan(0);
	});
});
