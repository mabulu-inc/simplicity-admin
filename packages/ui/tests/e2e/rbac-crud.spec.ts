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

// Helper: login as editor (app_editor role — read/write with some column restrictions)
async function loginAsEditor(page: import('@playwright/test').Page) {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill('editor@localhost');
	await page.getByTestId('password-input').fill('changeme');

	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('RBAC CRUD Integration', () => {
	test.describe('Viewer role — column filtering in list view', () => {
		test('app_viewer cannot see denied columns in list view', async ({ page }) => {
			await loginAsViewer(page);
			await page.goto('/contacts');
			await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

			// Viewer should see allowed columns
			const headers = page.locator('.data-table-header');
			const headerTexts = (await headers.allTextContents()).map((t) => t.trim());

			// Viewer has SELECT on id, first_name, last_name, email but NOT created_at
			expect(headerTexts).toContain('Id');
			expect(headerTexts).toContain('First Name');
			expect(headerTexts).toContain('Last Name');
			expect(headerTexts).toContain('Email');
			expect(headerTexts).not.toContain('Created At');
		});

		test('app_viewer does not see create button', async ({ page }) => {
			await loginAsViewer(page);
			await page.goto('/contacts');
			await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

			// Viewer has no INSERT permission — create button should not be visible
			await expect(page.getByTestId('create-button')).not.toBeVisible();
		});
	});

	test.describe('Editor role — read-only columns in edit form', () => {
		test('app_editor sees read-only columns in edit form', async ({ page }) => {
			await loginAsEditor(page);
			await page.goto('/contacts');
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

			// Click the first row to navigate to the detail view
			await page.locator('.data-table-row').first().click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
			await expect(page.getByTestId('edit-view')).toBeVisible({ timeout: 10_000 });

			// Editor has UPDATE on first_name, last_name, email
			// But created_at is SELECT-only (read-only in form)
			const createdAtField = page.locator('[name="created_at"]');
			if (await createdAtField.count() > 0) {
				await expect(createdAtField).toBeDisabled();
			}

			// Editable fields should NOT be disabled
			const firstNameField = page.locator('textarea[name="first_name"]');
			await expect(firstNameField).toBeEnabled();
		});
	});

	test.describe('Viewer role — no delete button', () => {
		test('app_viewer does not see delete button in edit view', async ({ page }) => {
			await loginAsViewer(page);
			await page.goto('/contacts');
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

			// Click the first row
			await page.locator('.data-table-row').first().click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
			await expect(page.getByTestId('edit-view')).toBeVisible({ timeout: 10_000 });

			// Viewer should not see the delete button
			await expect(page.locator('.btn-danger', { hasText: 'Delete' })).not.toBeVisible();
		});
	});
});
