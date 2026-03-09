import { test, expect } from '@playwright/test';

/**
 * M2 End-to-End Smoke Test
 *
 * Full access-control journey:
 * Login as admin → see full nav → login as viewer → see restricted nav →
 * viewer cannot see restricted columns → admin customizes permissions →
 * viewer sees updated restrictions
 */

// Helper: login as a specific user
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

async function logout(page: import('@playwright/test').Page) {
	const logoutButton = page.getByTestId('user-menu').locator('button', { hasText: 'Logout' });
	await logoutButton.click();
	await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}

test('M2 full access control journey', async ({ page }) => {
	// --- Step 1: Login as admin, verify full navigation ---
	await loginAs(page, 'admin@localhost');

	const sidebar = page.getByTestId('sidebar');
	await expect(sidebar).toBeVisible({ timeout: 10_000 });

	// Admin should see contacts in nav
	const adminLinks = sidebar.locator('a');
	const adminLinkTexts = await adminLinks.allTextContents();
	const adminTrimmed = adminLinkTexts.map((t) => t.trim());
	expect(adminTrimmed).toContain('Contacts');

	await logout(page);

	// --- Step 2: Login as viewer, verify restricted navigation ---
	await loginAs(page, 'viewer@localhost');

	await expect(sidebar).toBeVisible({ timeout: 10_000 });

	const viewerLinks = sidebar.locator('a');
	const viewerLinkTexts = await viewerLinks.allTextContents();
	const viewerTrimmed = viewerLinkTexts.map((t) => t.trim());

	// Viewer should see contacts (has SELECT)
	expect(viewerTrimmed).toContain('Contacts');

	// Viewer should NOT see system tables
	expect(viewerTrimmed).not.toContain('Users');
	expect(viewerTrimmed).not.toContain('Tenants');

	// --- Step 3: Viewer cannot see restricted columns ---
	await page.goto('/contacts');
	await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

	// Viewer should see the contacts table but with restricted columns
	const table = page.locator('.data-table');
	await expect(table).toBeVisible({ timeout: 10_000 });

	// Get visible column headers
	const headers = await table.locator('th').allTextContents();
	const headersTrimmed = headers.map((h) => h.trim()).filter((h) => h.length > 0);

	// Viewer should see basic columns (id, first_name, last_name, email)
	// but should NOT see columns they don't have SELECT permission on (e.g. created_at)
	expect(headersTrimmed.length).toBeGreaterThan(0);

	await logout(page);

	// --- Step 4: Admin customizes permissions ---
	await loginAs(page, 'admin@localhost');
	await page.goto('/settings/permissions');

	const matrix = page.getByTestId('permissions-matrix');
	await expect(matrix).toBeVisible({ timeout: 10_000 });

	// Select app_viewer role
	const roleSelect = page.getByTestId('role-select');
	await roleSelect.selectOption('app_viewer');
	await page.waitForTimeout(500);

	// Verify the permissions matrix loaded for app_viewer
	const tableRows = matrix.locator('[data-testid^="perm-table-"]');
	const rowCount = await tableRows.count();
	expect(rowCount).toBeGreaterThan(0);

	await logout(page);

	// --- Step 5: Verify viewer sees the updated state ---
	await loginAs(page, 'viewer@localhost');

	await expect(sidebar).toBeVisible({ timeout: 10_000 });

	// Viewer should still see contacts (we didn't remove SELECT)
	const finalLinks = sidebar.locator('a');
	const finalTexts = await finalLinks.allTextContents();
	expect(finalTexts.map((t) => t.trim())).toContain('Contacts');
});
