import { test, expect } from '@playwright/test';

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

test.describe('Workflow management UI', () => {
	test('state machine management page renders', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/workflow');

		await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 10_000 });

		// Should show list or empty state
		const hasList = await page.getByTestId('machines-list').isVisible().catch(() => false);
		const hasEmpty = await page.getByTestId('machines-empty').isVisible().catch(() => false);
		expect(hasList || hasEmpty).toBe(true);
	});

	test('can create a state machine', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/workflow');
		await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 10_000 });

		// Click create button
		await page.getByTestId('create-machine-button').click();
		await expect(page.getByTestId('machine-form')).toBeVisible({ timeout: 5_000 });

		// Fill in the form
		await page.getByTestId('machine-table-input').fill('e2e_workflow_test');
		await page.getByTestId('machine-column-input').fill('status');
		await page.getByTestId('machine-states-input').fill('draft,review,published');
		await page.getByTestId('machine-transitions-input').fill(
			JSON.stringify([
				{ from: 'draft', to: 'review', label: 'Submit', roles: ['app_admin'] },
				{ from: 'review', to: 'published', label: 'Publish', roles: ['app_admin'] },
			]),
		);

		// Submit
		await page.getByTestId('machine-save-button').click();
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('machines-list')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=e2e_workflow_test')).toBeVisible();
	});

	test('can delete a state machine', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/workflow');
		await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 10_000 });

		// If there are machines, delete the first one
		const hasList = await page.getByTestId('machines-list').isVisible().catch(() => false);
		if (hasList) {
			const deleteBtn = page.locator('[data-testid^="delete-machine-"]').first();
			if (await deleteBtn.isVisible()) {
				await deleteBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}
	});
});

test.describe('Automation management UI', () => {
	test('automations page renders', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/automations');

		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });

		// Should show list or empty state
		const hasList = await page.getByTestId('automations-list').isVisible().catch(() => false);
		const hasEmpty = await page.getByTestId('automations-empty').isVisible().catch(() => false);
		expect(hasList || hasEmpty).toBe(true);
	});

	test('can create an automation', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/automations');
		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });

		// Click create button
		await page.getByTestId('create-automation-button').click();
		await expect(page.getByTestId('automation-form')).toBeVisible({ timeout: 5_000 });

		// Fill in the form
		await page.getByTestId('automation-name-input').fill('E2E Test Automation');
		await page.getByTestId('automation-trigger-event-select').selectOption('onCreate');
		await page.getByTestId('automation-trigger-table-input').fill('contacts');
		await page.getByTestId('automation-actions-input').fill(
			JSON.stringify([{ type: 'send_email', config: { to: 'test@example.com', subject: 'New contact' } }]),
		);

		// Submit
		await page.getByTestId('automation-save-button').click();
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('automations-list')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=E2E Test Automation')).toBeVisible();
	});

	test('can toggle automation enabled state', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/automations');
		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });

		const hasList = await page.getByTestId('automations-list').isVisible().catch(() => false);
		if (hasList) {
			const toggle = page.locator('[data-testid^="toggle-automation-"]').first();
			if (await toggle.isVisible()) {
				const wasChecked = await toggle.isChecked();
				await toggle.click();
				await page.waitForTimeout(1000);
				const isChecked = await toggle.isChecked();
				expect(isChecked).not.toBe(wasChecked);
			}
		}
	});

	test('can delete an automation', async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto('/settings/automations');
		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });

		const hasList = await page.getByTestId('automations-list').isVisible().catch(() => false);
		if (hasList) {
			const deleteBtn = page.locator('[data-testid^="delete-automation-"]').first();
			if (await deleteBtn.isVisible()) {
				await deleteBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}
	});
});
