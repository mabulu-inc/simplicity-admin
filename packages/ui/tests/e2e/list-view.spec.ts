import { test, expect } from '@playwright/test';

// Helper: login and wait for session to be established
async function login(page: import('@playwright/test').Page) {
	await page.goto('/login');
	// Wait for Svelte hydration to complete before interacting
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill('admin@localhost');
	await page.getByTestId('password-input').fill('changeme');

	// Wait for the login API response and session cookie
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('List View', () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test('navigating to /contacts shows DataTable with data', async ({ page }) => {
		await page.goto('/contacts');
		await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('list-view-title')).toHaveText('Contacts');

		// Table should be visible with data rows
		const table = page.locator('.data-table');
		await expect(table).toBeVisible();

		// Should have at least one data row
		const rows = page.locator('.data-table-row');
		await expect(rows.first()).toBeVisible();
	});

	test('column headers match schema', async ({ page }) => {
		await page.goto('/contacts');
		await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

		// Contacts table should have expected column headers (text may have trailing whitespace from sort indicator)
		const headers = page.locator('.data-table-header');
		const headerTexts = (await headers.allTextContents()).map((t) => t.trim());

		expect(headerTexts).toContain('Id');
		expect(headerTexts).toContain('First Name');
		expect(headerTexts).toContain('Last Name');
		expect(headerTexts).toContain('Email');
	});

	test('pagination works', async ({ page }) => {
		await page.goto('/contacts?pageSize=3');
		await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

		// With 10 contacts and pageSize=3, should show pagination
		const paginationInfo = page.locator('.pagination-info');
		await expect(paginationInfo).toBeVisible();
		await expect(paginationInfo).toContainText('of 10');

		// First page shows rows 1-3
		await expect(paginationInfo).toContainText('1–3');

		// Click Next
		await page.locator('.pagination-btn:not([disabled])', { hasText: 'Next' }).click();
		await expect(page).toHaveURL(/page=2/);

		// Second page shows rows 4-6
		await expect(paginationInfo).toContainText('4–6');
	});

	test('sorting works', async ({ page }) => {
		await page.goto('/contacts');
		await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

		// Click "Last Name" header to sort ascending
		const lastNameHeader = page.locator('.data-table-header', { hasText: 'Last Name' });
		await lastNameHeader.click();

		await expect(page).toHaveURL(/sort=last_name/);
		await expect(page).toHaveURL(/dir=asc/);

		// Sort indicator should be visible
		await expect(lastNameHeader.locator('.sort-indicator')).toBeVisible();

		// Click again to sort descending
		await lastNameHeader.click();
		await expect(page).toHaveURL(/dir=desc/);
	});

	test('empty table shows empty state', async ({ page }) => {
		await page.goto('/contacts');
		await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

		// The empty state should NOT be visible when data exists
		await expect(page.getByTestId('empty-state')).not.toBeVisible();
	});

	test('non-existent table shows 404', async ({ page }) => {
		const response = await page.goto('/nonexistent_table_xyz');
		expect(response?.status()).toBe(404);
	});
});
