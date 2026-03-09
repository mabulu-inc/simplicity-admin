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

// Helper: login as viewer (app_viewer role — read-only, restricted columns)
async function loginAsViewer(page: import('@playwright/test').Page) {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill('viewer@localhost');
	await page.getByTestId('password-input').fill('changeme');

	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('Role-based navigation integration', () => {
	test('app_admin sees all tables in nav', async ({ page }) => {
		await loginAsAdmin(page);

		const sidebar = page.getByTestId('sidebar');
		await expect(sidebar).toBeVisible({ timeout: 10_000 });

		// Admin should see the contacts table in the sidebar
		const navLinks = sidebar.locator('a');
		const linkTexts = await navLinks.allTextContents();
		const trimmed = linkTexts.map((t) => t.trim());

		// Admin has full access — should see Contacts at minimum
		expect(trimmed).toContain('Contacts');
	});

	test('app_viewer sees only permitted tables', async ({ page }) => {
		await loginAsViewer(page);

		const sidebar = page.getByTestId('sidebar');
		await expect(sidebar).toBeVisible({ timeout: 10_000 });

		const navLinks = sidebar.locator('a');
		const linkTexts = await navLinks.allTextContents();
		const trimmed = linkTexts.map((t) => t.trim());

		// Viewer has SELECT on contacts — should see Contacts
		expect(trimmed).toContain('Contacts');

		// Viewer should NOT see system tables (audit_log, etc.)
		expect(trimmed).not.toContain('Users');
		expect(trimmed).not.toContain('Tenants');
		expect(trimmed).not.toContain('Memberships');
	});

	test('navigation groups render correctly', async ({ page }) => {
		await loginAsAdmin(page);

		const sidebar = page.getByTestId('sidebar');
		await expect(sidebar).toBeVisible({ timeout: 10_000 });

		// Nav items should be rendered as links inside the sidebar
		const navLinks = sidebar.locator('a');
		const count = await navLinks.count();
		expect(count).toBeGreaterThan(0);
	});

	test('active item is highlighted', async ({ page }) => {
		await loginAsAdmin(page);

		const sidebar = page.getByTestId('sidebar');
		await expect(sidebar).toBeVisible({ timeout: 10_000 });

		// Navigate to contacts
		await page.goto('/contacts');
		await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

		// The contacts link should have the active class
		const contactsLink = sidebar.locator('a[href="/contacts"]');
		await expect(contactsLink).toHaveClass(/active/);
	});
});
