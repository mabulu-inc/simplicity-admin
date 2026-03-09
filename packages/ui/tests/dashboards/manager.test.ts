// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPool } from '@simplicity-admin/db';
import type { ConnectionPool } from '@simplicity-admin/core';
import {
	createDashboard,
	updateDashboard,
	deleteDashboard,
	getDashboard,
	listDashboards,
	getDefaultDashboard,
	createWidget,
	updateWidget,
	deleteWidget,
} from '../../src/lib/dashboards/manager.js';

const DB_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

describe('Dashboard Manager (integration)', () => {
	let pool: ConnectionPool;

	beforeAll(async () => {
		pool = createPool(DB_URL);

		// Create tables for testing
		await pool.query(`
			CREATE TABLE IF NOT EXISTS simplicity_dashboards (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				name text NOT NULL,
				slug text NOT NULL UNIQUE,
				roles text[] NOT NULL DEFAULT '{}'::text[],
				is_default boolean NOT NULL DEFAULT false,
				layout jsonb NOT NULL DEFAULT '[]'::jsonb,
				created_by text NOT NULL,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS simplicity_widgets (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				type text NOT NULL,
				title text NOT NULL,
				config jsonb NOT NULL DEFAULT '{}'::jsonb,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			)
		`);
	});

	afterAll(async () => {
		// Cleanup test data
		await pool.query('DELETE FROM simplicity_dashboards');
		await pool.query('DELETE FROM simplicity_widgets');
		await pool.end();
	});

	describe('Dashboard CRUD', () => {
		let dashboardId: string;

		it('creates a dashboard', async () => {
			const dashboard = await createDashboard(pool, {
				name: 'Admin Dashboard',
				slug: 'admin-dashboard',
				roles: ['app_admin'],
				isDefault: true,
				layout: [{ widgetId: 'w1', x: 0, y: 0, width: 6, height: 2 }],
				createdBy: 'test-user',
			});

			expect(dashboard.id).toBeDefined();
			expect(dashboard.name).toBe('Admin Dashboard');
			expect(dashboard.slug).toBe('admin-dashboard');
			expect(dashboard.roles).toEqual(['app_admin']);
			expect(dashboard.isDefault).toBe(true);
			expect(dashboard.layout).toEqual([{ widgetId: 'w1', x: 0, y: 0, width: 6, height: 2 }]);
			expect(dashboard.createdBy).toBe('test-user');
			expect(dashboard.createdAt).toBeInstanceOf(Date);
			expect(dashboard.updatedAt).toBeInstanceOf(Date);

			dashboardId = dashboard.id;
		});

		it('gets a dashboard by id', async () => {
			const dashboard = await getDashboard(pool, dashboardId);
			expect(dashboard).not.toBeNull();
			expect(dashboard!.name).toBe('Admin Dashboard');
		});

		it('returns null for non-existent dashboard', async () => {
			const dashboard = await getDashboard(pool, '00000000-0000-0000-0000-000000000000');
			expect(dashboard).toBeNull();
		});

		it('updates a dashboard', async () => {
			const updated = await updateDashboard(pool, dashboardId, {
				name: 'Updated Dashboard',
			});
			expect(updated.name).toBe('Updated Dashboard');
			expect(updated.slug).toBe('admin-dashboard');
		});

		it('deletes a dashboard', async () => {
			// Create one to delete
			const d = await createDashboard(pool, {
				name: 'To Delete',
				slug: 'to-delete',
				roles: [],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await deleteDashboard(pool, d.id);
			const result = await getDashboard(pool, d.id);
			expect(result).toBeNull();
		});
	});

	describe('listDashboards filters by role', () => {
		beforeAll(async () => {
			// Clean up and seed
			await pool.query("DELETE FROM simplicity_dashboards WHERE slug LIKE 'list-test-%'");

			await createDashboard(pool, {
				name: 'Admin Only',
				slug: 'list-test-admin',
				roles: ['app_admin'],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(pool, {
				name: 'Viewer Only',
				slug: 'list-test-viewer',
				roles: ['app_viewer'],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(pool, {
				name: 'All Roles',
				slug: 'list-test-all',
				roles: [],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});
		});

		it('returns all dashboards when no role filter', async () => {
			const all = await listDashboards(pool);
			expect(all.length).toBeGreaterThanOrEqual(3);
		});

		it('filters dashboards by role', async () => {
			const adminDashboards = await listDashboards(pool, 'app_admin');
			const slugs = adminDashboards.map((d) => d.slug);
			expect(slugs).toContain('list-test-admin');
			expect(slugs).toContain('list-test-all');
			expect(slugs).not.toContain('list-test-viewer');
		});

		it('includes dashboards with empty roles array (visible to all)', async () => {
			const viewerDashboards = await listDashboards(pool, 'app_viewer');
			const slugs = viewerDashboards.map((d) => d.slug);
			expect(slugs).toContain('list-test-viewer');
			expect(slugs).toContain('list-test-all');
		});
	});

	describe('getDefaultDashboard', () => {
		beforeAll(async () => {
			// Clear all existing defaults to isolate this test
			await pool.query("UPDATE simplicity_dashboards SET is_default = false WHERE slug NOT LIKE 'default-test-%'");
			await pool.query("DELETE FROM simplicity_dashboards WHERE slug LIKE 'default-test-%'");

			await createDashboard(pool, {
				name: 'Default Admin',
				slug: 'default-test-admin',
				roles: ['app_admin'],
				isDefault: true,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(pool, {
				name: 'Default Viewer',
				slug: 'default-test-viewer',
				roles: ['app_viewer'],
				isDefault: true,
				layout: [],
				createdBy: 'test-user',
			});
		});

		it('returns the default dashboard for a role', async () => {
			const dashboard = await getDefaultDashboard(pool, 'app_admin');
			expect(dashboard).not.toBeNull();
			expect(dashboard!.slug).toBe('default-test-admin');
		});

		it('returns null when no default for role', async () => {
			const dashboard = await getDefaultDashboard(pool, 'app_editor');
			expect(dashboard).toBeNull();
		});
	});

	describe('Widget CRUD', () => {
		let widgetId: string;

		it('creates a widget', async () => {
			const widget = await createWidget(pool, {
				type: 'stat',
				title: 'Total Users',
				config: {
					query: 'SELECT COUNT(*) AS value FROM users',
					format: 'number',
				},
			});

			expect(widget.id).toBeDefined();
			expect(widget.type).toBe('stat');
			expect(widget.title).toBe('Total Users');
			expect(widget.config).toEqual({
				query: 'SELECT COUNT(*) AS value FROM users',
				format: 'number',
			});

			widgetId = widget.id;
		});

		it('updates a widget', async () => {
			const updated = await updateWidget(pool, widgetId, {
				title: 'Active Users',
			});
			expect(updated.title).toBe('Active Users');
			expect(updated.type).toBe('stat');
		});

		it('deletes a widget', async () => {
			const w = await createWidget(pool, {
				type: 'table',
				title: 'To Delete',
				config: {
					query: 'SELECT 1',
					columns: [{ key: 'id', label: 'ID' }],
				},
			});

			await deleteWidget(pool, w.id);

			// Verify deleted — query directly
			const result = await pool.query<{ count: string }>(
				'SELECT COUNT(*) AS count FROM simplicity_widgets WHERE id = $1',
				[w.id],
			);
			expect(parseInt(result.rows[0].count, 10)).toBe(0);
		});
	});
});
