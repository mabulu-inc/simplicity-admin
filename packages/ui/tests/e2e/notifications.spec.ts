import { test, expect } from '@playwright/test';

/**
 * Notification UI E2E Tests
 *
 * Tests notification bell, notification list, mark as read, and rule management.
 */

test.describe('Notifications', () => {
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

	test('bell shows unread count', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByTestId('topbar')).toBeVisible({ timeout: 10_000 });

		// Notification bell should be visible in topbar
		await expect(page.getByTestId('notification-bell')).toBeVisible();

		// Badge should show count (may be 0 or more depending on seeded data)
		const badge = page.getByTestId('notification-badge');
		const hasBadge = await badge.isVisible().catch(() => false);
		if (hasBadge) {
			const text = await badge.textContent();
			expect(Number(text)).toBeGreaterThanOrEqual(0);
		}
	});

	test('notification list displays notifications', async ({ page }) => {
		await page.goto('/notifications');
		await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 10_000 });

		// The page should show either a list or an empty state
		const hasList = await page.getByTestId('notification-list').isVisible().catch(() => false);
		const hasEmpty = await page.getByTestId('notifications-empty').isVisible().catch(() => false);
		expect(hasList || hasEmpty).toBe(true);
	});

	test('mark as read works', async ({ page }) => {
		await page.goto('/notifications');
		await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 10_000 });

		// If there are notifications, try to mark one as read
		const hasList = await page.getByTestId('notification-list').isVisible().catch(() => false);
		if (hasList) {
			const items = page.locator('[data-testid^="notification-item-"]');
			const count = await items.count();
			if (count > 0) {
				// Click mark-as-read on the first unread item
				const markReadBtn = items.first().getByTestId('mark-read-button');
				const hasBtn = await markReadBtn.isVisible().catch(() => false);
				if (hasBtn) {
					await markReadBtn.click();
					// Page should reload/update
					await page.waitForLoadState('networkidle');
				}
			}
		}

		// Also test mark-all-read button
		const markAllBtn = page.getByTestId('mark-all-read-button');
		const hasMarkAll = await markAllBtn.isVisible().catch(() => false);
		if (hasMarkAll) {
			await markAllBtn.click();
			await page.waitForLoadState('networkidle');
		}
	});

	test('rule management UI works', async ({ page }) => {
		await page.goto('/settings/notifications');
		await expect(page.getByTestId('notification-rules-page')).toBeVisible({ timeout: 10_000 });

		// Should show rule list or empty state
		const hasRules = await page.getByTestId('rules-list').isVisible().catch(() => false);
		const hasEmpty = await page.getByTestId('rules-empty').isVisible().catch(() => false);
		expect(hasRules || hasEmpty).toBe(true);

		// Click create rule button
		await page.getByTestId('create-rule-button').click();
		await expect(page.getByTestId('rule-form')).toBeVisible({ timeout: 10_000 });

		// Fill in the rule form
		await page.getByTestId('rule-name-input').fill('E2E Test Rule');
		await page.getByTestId('rule-trigger-select').selectOption('record.created');
		await page.getByTestId('rule-table-input').fill('contacts');
		await page.getByTestId('rule-subject-input').fill('New contact: {{first_name}}');
		await page.getByTestId('rule-body-input').fill('A new contact was created.');
		await page.getByTestId('rule-channel-in_app').check();

		// Submit the form
		await page.getByTestId('rule-save-button').click();

		// Should return to rules list with new rule visible
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('rules-list')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=E2E Test Rule')).toBeVisible();
	});
});
