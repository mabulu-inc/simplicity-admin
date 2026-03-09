import { test, expect } from '@playwright/test';

/**
 * M1 End-to-End Smoke Test
 *
 * Full user journey: login → see admin shell with nav → navigate to table list →
 * create record → edit record → delete record → logout
 */
test('M1 full user journey', async ({ page }) => {
	// 1. Unauthenticated user is redirected to login
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);

	// 2. Login with default admin credentials
	await page.waitForLoadState('networkidle');
	await page.getByTestId('email-input').fill('admin@localhost');
	await page.getByTestId('password-input').fill('changeme');

	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 20_000 }),
		page.getByTestId('login-button').click(),
	]);
	await page.waitForURL('/', { timeout: 15_000 });

	// 3. See admin home with auto-generated nav (sidebar + shell)
	await expect(page.getByTestId('admin-home')).toBeVisible();
	await expect(page.locator('.shell')).toBeVisible();
	await expect(page.getByTestId('sidebar')).toBeVisible();
	await expect(page.getByTestId('topbar')).toBeVisible();
	await expect(page.getByTestId('user-menu')).toBeVisible();

	// 4. Navigate to table list (contacts)
	await page.goto('/contacts');
	await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('.data-table')).toBeVisible();

	// Verify table has rows (seeded by global setup)
	const rowCount = await page.locator('.data-table-row').count();
	expect(rowCount).toBeGreaterThan(0);

	// 5. Create a new record
	await page.goto('/contacts/new');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

	await page.locator('textarea[name="first_name"]').fill('SmokeTest');
	await page.locator('textarea[name="last_name"]').fill('M1Journey');
	await page.locator('textarea[name="email"]').fill('smoke-m1@example.com');
	await page.locator('button[type="submit"]').click();

	// Should redirect back to list view
	await page.waitForURL('/contacts', { timeout: 10_000 });
	await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

	// Verify the new record appears
	await expect(page.locator('.data-table-row', { hasText: 'SmokeTest' })).toBeVisible({ timeout: 10_000 });

	// 6. Edit the record — click the row to open edit view
	await page.locator('.data-table-row', { hasText: 'SmokeTest' }).click();
	await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
	await expect(page.getByTestId('edit-view')).toBeVisible({ timeout: 10_000 });

	// Verify form is populated with the created values
	await expect(page.locator('textarea[name="first_name"]')).toHaveValue('SmokeTest');

	// Update the email
	const emailInput = page.locator('textarea[name="email"]');
	await emailInput.clear();
	await emailInput.fill('smoke-m1-updated@example.com');
	await page.locator('button[type="submit"]').click();

	// Should redirect to list view
	await page.waitForURL('/contacts', { timeout: 10_000 });
	await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

	// 7. Delete the record — navigate back to the edit view
	await page.locator('.data-table-row', { hasText: 'SmokeTest' }).click();
	await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
	await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

	// Click delete button
	await page.locator('.btn-danger', { hasText: 'Delete' }).click();

	// Confirm deletion
	await expect(page.getByTestId('confirm-dialog')).toBeVisible();
	await page.getByTestId('confirm-delete-button').click();

	// Should redirect to list view with record gone
	await page.waitForURL('/contacts', { timeout: 10_000 });
	await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('.data-table-row', { hasText: 'SmokeTest' })).not.toBeVisible();

	// 8. Logout
	const logoutButton = page.getByTestId('user-menu').locator('button', { hasText: 'Logout' });
	await logoutButton.click();

	// Should redirect to login page
	await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
	await expect(page.getByTestId('login-page')).toBeVisible();
});
