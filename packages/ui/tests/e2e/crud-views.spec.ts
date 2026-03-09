import { test, expect } from '@playwright/test';

// Helper: login and wait for session to be established
async function login(page: import('@playwright/test').Page) {
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

test.describe('CRUD Views', () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.describe('Create View', () => {
		test('/contacts/new shows create form', async ({ page }) => {
			await page.goto('/contacts/new');
			await expect(page.getByTestId('create-view')).toBeVisible({ timeout: 10_000 });
			await expect(page.getByTestId('create-view-title')).toHaveText('Create Contact');

			// AutoForm should be visible with fields (not PK/generated columns in create mode)
			const form = page.locator('.auto-form');
			await expect(form).toBeVisible();

			// Should have first_name, last_name, email fields but not id or created_at (they have defaults)
			await expect(page.locator('label', { hasText: 'First Name' })).toBeVisible();
			await expect(page.locator('label', { hasText: 'Last Name' })).toBeVisible();
			await expect(page.locator('label', { hasText: 'Email' })).toBeVisible();
		});

		test('create form submits and creates record', async ({ page }) => {
			await page.goto('/contacts/new');
			await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

			// Fill in the form
			await page.locator('textarea[name="first_name"]').fill('Zara');
			await page.locator('textarea[name="last_name"]').fill('TestCreate');
			await page.locator('textarea[name="email"]').fill('zara@example.com');

			// Submit the form
			await page.locator('button[type="submit"]').click();

			// Should redirect to the list view
			await page.waitForURL('/contacts', { timeout: 10_000 });

			// The new record should appear in the list
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
			await expect(page.getByRole('cell', { name: 'Zara', exact: true }).first()).toBeVisible();
		});
	});

	test.describe('Edit View', () => {
		test('/contacts/[id] shows edit form with values', async ({ page }) => {
			// First navigate to the list to get a real record ID
			await page.goto('/contacts');
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

			// Click the first row to navigate to the detail view
			await page.locator('.data-table-row').first().click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });

			// Should show the edit view
			await expect(page.getByTestId('edit-view')).toBeVisible({ timeout: 10_000 });
			await expect(page.getByTestId('edit-view-title')).toContainText('Edit Contact');

			// Form should be visible with populated values
			const form = page.locator('.auto-form');
			await expect(form).toBeVisible();

			// Fields should have values filled in
			const firstNameInput = page.locator('textarea[name="first_name"]');
			await expect(firstNameInput).toHaveValue(/.+/);
		});

		test('edit form submits partial update', async ({ page }) => {
			// Navigate to a specific contact via the list
			await page.goto('/contacts');
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
			await page.locator('.data-table-row').first().click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
			await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

			// Change the email field
			const emailInput = page.locator('textarea[name="email"]');
			await emailInput.clear();
			await emailInput.fill('updated@example.com');

			// Submit
			await page.locator('button[type="submit"]').click();

			// Should redirect to list view
			await page.waitForURL('/contacts', { timeout: 10_000 });

			// Toast or redirect confirms success
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
		});
	});

	test.describe('Delete', () => {
		test('delete shows confirmation, then removes record', async ({ page }) => {
			// First create a record to delete
			await page.goto('/contacts/new');
			await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });
			await page.locator('textarea[name="first_name"]').fill('DeleteMe');
			await page.locator('textarea[name="last_name"]').fill('TestDelete');
			await page.locator('textarea[name="email"]').fill('deleteme@example.com');
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('/contacts', { timeout: 10_000 });

			// Find and click the row with "DeleteMe"
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
			await page.locator('.data-table-row', { hasText: 'DeleteMe' }).click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
			await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

			// Click Delete button
			await page.locator('.btn-danger', { hasText: 'Delete' }).click();

			// Confirmation dialog should appear
			await expect(page.getByTestId('confirm-dialog')).toBeVisible();
			await expect(page.getByTestId('confirm-dialog')).toContainText('Are you sure');

			// Confirm deletion
			await page.getByTestId('confirm-delete-button').click();

			// Should redirect to list view
			await page.waitForURL('/contacts', { timeout: 10_000 });

			// The deleted record should no longer appear
			await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
			await expect(page.locator('text=DeleteMe')).not.toBeVisible();
		});
	});
});
