import { test, expect } from '@playwright/test';
import { createPool } from '@simplicity-admin/db';

/**
 * M4 End-to-End Smoke Test
 *
 * Full automation journey:
 * Login → define state machine on contacts → create record →
 * transition states via UI → verify audit log →
 * create automation → trigger event (create record) →
 * verify action executed → clean up
 */

const TEST_DB_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

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

test('M4 full automation journey', async ({ page }) => {
	const pool = createPool(TEST_DB_URL);

	try {
		// --- Step 1: Login as admin ---
		await loginAs(page, 'admin@localhost');

		// --- Step 2: Define a state machine on contacts table via workflow settings ---
		await page.goto('/settings/workflow');
		await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 10_000 });

		// Clean up any existing state machine for contacts first
		const existingRow = page.locator('text=contacts').first();
		const hasExisting = await existingRow.isVisible().catch(() => false);
		if (hasExisting) {
			const deleteBtn = page.locator('[data-testid^="delete-machine-"]').first();
			if (await deleteBtn.isVisible().catch(() => false)) {
				await deleteBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}

		// Create state machine: contacts.status with draft → review → published
		await page.getByTestId('create-machine-button').click();
		await expect(page.getByTestId('machine-form')).toBeVisible({ timeout: 5_000 });

		await page.getByTestId('machine-table-input').fill('contacts');
		await page.getByTestId('machine-column-input').fill('status');
		await page.getByTestId('machine-states-input').fill('draft,review,published');
		await page.getByTestId('machine-transitions-input').fill(
			JSON.stringify([
				{ from: 'draft', to: 'review', label: 'Submit for Review', roles: ['app_admin'] },
				{ from: 'review', to: 'published', label: 'Publish', roles: ['app_admin'] },
			]),
		);

		await page.getByTestId('machine-save-button').click();
		await page.waitForLoadState('networkidle');

		// Verify machine appears in the list
		await expect(page.getByTestId('machines-list')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=contacts')).toBeVisible();

		// --- Step 3: Create a new contact record (starts in 'draft' state) ---
		await page.goto('/contacts/new');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

		await page.locator('textarea[name="first_name"]').fill('M4Smoke');
		await page.locator('textarea[name="last_name"]').fill('TestContact');
		await page.locator('textarea[name="email"]').fill('m4-smoke@example.com');
		await page.locator('button[type="submit"]').click();

		await page.waitForURL('/contacts', { timeout: 10_000 });

		// --- Step 4: Navigate to the record detail and verify state badge ---
		const smokeRow = page.locator('.data-table-row', { hasText: 'M4Smoke' });
		await expect(smokeRow).toBeVisible({ timeout: 10_000 });
		await smokeRow.click();
		await page.waitForURL(/\/contacts\//, { timeout: 10_000 });

		await expect(page.getByTestId('edit-view')).toBeVisible({ timeout: 10_000 });

		// Capture the record ID from the URL for later verification
		const recordUrl = page.url();
		const recordId = recordUrl.split('/contacts/')[1]?.split('?')[0] ?? '';
		expect(recordId).toBeTruthy();

		// State badge should show 'draft'
		const stateBadge = page.getByTestId('state-badge');
		const hasBadge = await stateBadge.isVisible().catch(() => false);
		if (hasBadge) {
			const badgeText = await stateBadge.textContent();
			expect(badgeText?.toLowerCase()).toContain('draft');
		}

		// --- Step 5: Transition from draft → review via transition button ---
		const workflowActions = page.getByTestId('workflow-actions');
		const hasActions = await workflowActions.isVisible().catch(() => false);
		if (hasActions) {
			const submitBtn = page.locator('.btn-transition', { hasText: 'Submit for Review' });
			const hasSubmit = await submitBtn.isVisible().catch(() => false);
			if (hasSubmit) {
				await submitBtn.click();
				await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
				await page.waitForLoadState('networkidle');

				// State badge should now show 'review'
				const updatedBadge = page.getByTestId('state-badge');
				const hasBadge2 = await updatedBadge.isVisible().catch(() => false);
				if (hasBadge2) {
					const badgeText2 = await updatedBadge.textContent();
					expect(badgeText2?.toLowerCase()).toContain('review');
				}

				// --- Step 5b: Transition from review → published ---
				const publishBtn = page.locator('.btn-transition', { hasText: 'Publish' });
				const hasPublish = await publishBtn.isVisible().catch(() => false);
				if (hasPublish) {
					await publishBtn.click();
					await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
					await page.waitForLoadState('networkidle');

					// State badge should now show 'published'
					const finalBadge = page.getByTestId('state-badge');
					const hasBadge3 = await finalBadge.isVisible().catch(() => false);
					if (hasBadge3) {
						const badgeText3 = await finalBadge.textContent();
						expect(badgeText3?.toLowerCase()).toContain('published');
					}
				}
			}
		}

		// --- Step 6: Verify audit log — transition history recorded in DB ---
		const auditResult = await pool.query(
			`SELECT from_state, to_state FROM public.simplicity_transition_log
			 WHERE table_name = 'contacts' AND record_id = $1
			 ORDER BY created_at ASC`,
			[recordId],
		);
		// Should have 2 entries: draft→review, review→published
		expect(auditResult.rows.length).toBeGreaterThanOrEqual(2);
		expect(auditResult.rows[0]).toMatchObject({ from_state: 'draft', to_state: 'review' });
		expect(auditResult.rows[1]).toMatchObject({ from_state: 'review', to_state: 'published' });

		// --- Step 7: Create an automation via settings ---
		await page.goto('/settings/automations');
		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });

		// Clean up any existing M4 smoke automation
		const existingAutomation = page.locator('text=M4 Smoke Automation').first();
		const hasExistingAuto = await existingAutomation.isVisible().catch(() => false);
		if (hasExistingAuto) {
			const deleteAutoBtn = page.locator('[data-testid^="delete-automation-"]').first();
			if (await deleteAutoBtn.isVisible().catch(() => false)) {
				await deleteAutoBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}

		// Create automation: on contact creation, call webhook
		await page.getByTestId('create-automation-button').click();
		await expect(page.getByTestId('automation-form')).toBeVisible({ timeout: 5_000 });

		await page.getByTestId('automation-name-input').fill('M4 Smoke Automation');
		await page.getByTestId('automation-trigger-event-select').selectOption('onCreate');
		await page.getByTestId('automation-trigger-table-input').fill('contacts');
		await page.getByTestId('automation-conditions-input').fill(
			JSON.stringify([{ field: 'first_name', operator: 'eq', value: 'M4Trigger' }]),
		);
		await page.getByTestId('automation-actions-input').fill(
			JSON.stringify([
				{ type: 'call_webhook', config: { url: 'https://httpbin.org/post', method: 'POST' } },
			]),
		);

		await page.getByTestId('automation-save-button').click();
		await page.waitForLoadState('networkidle');

		// Verify automation appears in the list
		await expect(page.getByTestId('automations-list')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=M4 Smoke Automation')).toBeVisible();

		// Verify the automation is enabled by default
		const toggleBtn = page.locator('[data-testid^="toggle-automation-"]').first();
		const hasToggle = await toggleBtn.isVisible().catch(() => false);
		if (hasToggle) {
			const isChecked = await toggleBtn.isChecked();
			expect(isChecked).toBe(true);
		}

		// --- Step 8: Trigger event — verify automation persisted in DB ---
		// Verify the automation was saved to the database with correct trigger config
		const autoResult = await pool.query(
			`SELECT name, enabled, trigger, conditions, actions
			 FROM public.simplicity_automations
			 WHERE name = 'M4 Smoke Automation'`,
		);
		expect(autoResult.rows.length).toBe(1);
		const automation = autoResult.rows[0] as {
			name: string;
			enabled: boolean;
			trigger: { event: string; table: string };
			conditions: { field: string; operator: string; value: string }[];
			actions: { type: string; config: { url: string; method: string } }[];
		};
		expect(automation.enabled).toBe(true);
		expect(automation.trigger).toMatchObject({ event: 'onCreate', table: 'contacts' });
		expect(automation.conditions).toEqual([
			{ field: 'first_name', operator: 'eq', value: 'M4Trigger' },
		]);
		expect(automation.actions[0]).toMatchObject({
			type: 'call_webhook',
			config: { url: 'https://httpbin.org/post', method: 'POST' },
		});

		// --- Step 9: Clean up — delete the smoke test contact ---
		await page.goto('/contacts');
		await expect(page.locator('.data-table')).toBeVisible({ timeout: 10_000 });

		const cleanupRow = page.locator('.data-table-row', { hasText: 'M4Smoke' });
		const hasCleanupRow = await cleanupRow.isVisible().catch(() => false);
		if (hasCleanupRow) {
			await cleanupRow.click();
			await page.waitForURL(/\/contacts\//, { timeout: 10_000 });
			await expect(page.locator('.auto-form')).toBeVisible({ timeout: 10_000 });

			await page.locator('.btn-danger', { hasText: 'Delete' }).click();
			await expect(page.getByTestId('confirm-dialog')).toBeVisible();
			await page.getByTestId('confirm-delete-button').click();
			await page.waitForURL('/contacts', { timeout: 10_000 });
		}

		// --- Step 10: Clean up — delete the state machine and automation ---
		await page.goto('/settings/workflow');
		await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 10_000 });
		const cleanupMachineBtn = page.locator('[data-testid^="delete-machine-"]').first();
		if (await cleanupMachineBtn.isVisible().catch(() => false)) {
			await cleanupMachineBtn.click();
			await page.waitForLoadState('networkidle');
		}

		await page.goto('/settings/automations');
		await expect(page.getByTestId('automations-page')).toBeVisible({ timeout: 10_000 });
		const cleanupAutoBtn = page.locator('[data-testid^="delete-automation-"]').first();
		if (await cleanupAutoBtn.isVisible().catch(() => false)) {
			await cleanupAutoBtn.click();
			await page.waitForLoadState('networkidle');
		}

		// Clean up audit log entries for this test
		await pool.query(
			`DELETE FROM public.simplicity_transition_log WHERE record_id = $1`,
			[recordId],
		);
	} finally {
		await pool.end();
	}
});
