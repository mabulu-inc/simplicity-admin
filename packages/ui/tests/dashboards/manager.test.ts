// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ConnectionPool } from '@mabulu-inc/simplicity-admin-core';
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
	parseWidgetConfig,
} from '../../src/lib/dashboards/manager.js';
import { createTestDb, destroyTestDb, type TestDb } from '@mabulu-inc/simplicity-admin-test-support';

describe('Dashboard Manager (integration)', () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();

		// Create tables for testing
		await testDb.pool.query(`
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

		await testDb.pool.query(`
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
		await destroyTestDb(testDb);
	});

	describe('Dashboard CRUD', () => {
		let dashboardId: string;

		it('creates a dashboard', async () => {
			const dashboard = await createDashboard(testDb.pool, {
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
			const dashboard = await getDashboard(testDb.pool, dashboardId);
			expect(dashboard).not.toBeNull();
			expect(dashboard!.name).toBe('Admin Dashboard');
		});

		it('returns null for non-existent dashboard', async () => {
			const dashboard = await getDashboard(testDb.pool, '00000000-0000-0000-0000-000000000000');
			expect(dashboard).toBeNull();
		});

		it('updates a dashboard', async () => {
			const updated = await updateDashboard(testDb.pool, dashboardId, {
				name: 'Updated Dashboard',
			});
			expect(updated.name).toBe('Updated Dashboard');
			expect(updated.slug).toBe('admin-dashboard');
		});

		it('deletes a dashboard', async () => {
			const d = await createDashboard(testDb.pool, {
				name: 'To Delete',
				slug: 'to-delete',
				roles: [],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await deleteDashboard(testDb.pool, d.id);
			const result = await getDashboard(testDb.pool, d.id);
			expect(result).toBeNull();
		});
	});

	describe('listDashboards filters by role', () => {
		beforeAll(async () => {
			await testDb.pool.query("DELETE FROM simplicity_dashboards WHERE slug LIKE 'list-test-%'");

			await createDashboard(testDb.pool, {
				name: 'Admin Only',
				slug: 'list-test-admin',
				roles: ['app_admin'],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(testDb.pool, {
				name: 'Viewer Only',
				slug: 'list-test-viewer',
				roles: ['app_viewer'],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(testDb.pool, {
				name: 'All Roles',
				slug: 'list-test-all',
				roles: [],
				isDefault: false,
				layout: [],
				createdBy: 'test-user',
			});
		});

		it('returns all dashboards when no role filter', async () => {
			const all = await listDashboards(testDb.pool);
			expect(all.length).toBeGreaterThanOrEqual(3);
		});

		it('filters dashboards by role', async () => {
			const adminDashboards = await listDashboards(testDb.pool, 'app_admin');
			const slugs = adminDashboards.map((d) => d.slug);
			expect(slugs).toContain('list-test-admin');
			expect(slugs).toContain('list-test-all');
			expect(slugs).not.toContain('list-test-viewer');
		});

		it('includes dashboards with empty roles array (visible to all)', async () => {
			const viewerDashboards = await listDashboards(testDb.pool, 'app_viewer');
			const slugs = viewerDashboards.map((d) => d.slug);
			expect(slugs).toContain('list-test-viewer');
			expect(slugs).toContain('list-test-all');
		});
	});

	describe('getDefaultDashboard', () => {
		beforeAll(async () => {
			await testDb.pool.query("UPDATE simplicity_dashboards SET is_default = false WHERE slug NOT LIKE 'default-test-%'");
			await testDb.pool.query("DELETE FROM simplicity_dashboards WHERE slug LIKE 'default-test-%'");

			await createDashboard(testDb.pool, {
				name: 'Default Admin',
				slug: 'default-test-admin',
				roles: ['app_admin'],
				isDefault: true,
				layout: [],
				createdBy: 'test-user',
			});

			await createDashboard(testDb.pool, {
				name: 'Default Viewer',
				slug: 'default-test-viewer',
				roles: ['app_viewer'],
				isDefault: true,
				layout: [],
				createdBy: 'test-user',
			});
		});

		it('returns the default dashboard for a role', async () => {
			const dashboard = await getDefaultDashboard(testDb.pool, 'app_admin');
			expect(dashboard).not.toBeNull();
			expect(dashboard!.slug).toBe('default-test-admin');
		});

		it('returns null when no default for role', async () => {
			const dashboard = await getDefaultDashboard(testDb.pool, 'app_editor');
			expect(dashboard).toBeNull();
		});
	});

	describe('parseWidgetConfig', () => {
		it('parses valid stat config', () => {
			const config = parseWidgetConfig('stat', { query: 'SELECT 1', format: 'number' });
			expect(config).toEqual({ query: 'SELECT 1', format: 'number' });
		});

		it('parses valid table config', () => {
			const config = parseWidgetConfig('table', {
				query: 'SELECT 1',
				columns: [{ key: 'id', label: 'ID' }],
			});
			expect(config).toEqual({
				query: 'SELECT 1',
				columns: [{ key: 'id', label: 'ID' }],
			});
		});

		it('parses valid chart config', () => {
			const config = parseWidgetConfig('chart', {
				type: 'bar',
				query: 'SELECT 1',
			});
			expect(config).toEqual({ type: 'bar', query: 'SELECT 1' });
		});

		it('throws on missing query in stat config', () => {
			expect(() => parseWidgetConfig('stat', { format: 'number' })).toThrow();
		});

		it('throws on missing columns in table config', () => {
			expect(() => parseWidgetConfig('table', { query: 'SELECT 1' })).toThrow();
		});

		it('throws on missing type in chart config', () => {
			expect(() => parseWidgetConfig('chart', { query: 'SELECT 1' })).toThrow();
		});

		it('throws on completely malformed config', () => {
			expect(() => parseWidgetConfig('stat', { bogus: true })).toThrow();
		});

		it('throws on unknown widget type', () => {
			expect(() => parseWidgetConfig('unknown' as 'stat', { query: 'SELECT 1' })).toThrow();
		});

		it('strips unknown properties', () => {
			const config = parseWidgetConfig('stat', { query: 'SELECT 1', extra: 'field' });
			expect(config).toEqual({ query: 'SELECT 1' });
			expect('extra' in config).toBe(false);
		});
	});

	describe('Widget with malformed DB config', () => {
		it('rejects widget with malformed config from DB', async () => {
			// Insert a widget with invalid config directly via SQL to simulate corrupt DB data
			const result = await testDb.pool.query<{ id: string }>(
				`INSERT INTO simplicity_widgets (type, title, config)
				 VALUES ('stat', 'Bad Widget', '{"bogus": true}')
				 RETURNING id`,
			);

			// Attempting to read this widget through the CRUD layer should throw
			const widgetResult = await testDb.pool.query<{ id: string; type: string; title: string; config: Record<string, unknown> }>(
				'SELECT * FROM simplicity_widgets WHERE id = $1',
				[result.rows[0].id],
			);
			const row = widgetResult.rows[0];

			expect(() =>
				parseWidgetConfig(row.type as 'stat' | 'table' | 'chart', row.config),
			).toThrow();

			// Clean up
			await testDb.pool.query('DELETE FROM simplicity_widgets WHERE id = $1', [result.rows[0].id]);
		});
	});

	describe('Widget CRUD', () => {
		let widgetId: string;

		it('creates a widget', async () => {
			const widget = await createWidget(testDb.pool, {
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
			const updated = await updateWidget(testDb.pool, widgetId, {
				title: 'Active Users',
			});
			expect(updated.title).toBe('Active Users');
			expect(updated.type).toBe('stat');
		});

		it('deletes a widget', async () => {
			const w = await createWidget(testDb.pool, {
				type: 'table',
				title: 'To Delete',
				config: {
					query: 'SELECT 1',
					columns: [{ key: 'id', label: 'ID' }],
				},
			});

			await deleteWidget(testDb.pool, w.id);

			const result = await testDb.pool.query<{ count: string }>(
				'SELECT COUNT(*) AS count FROM simplicity_widgets WHERE id = $1',
				[w.id],
			);
			expect(parseInt(result.rows[0].count, 10)).toBe(0);
		});
	});
});
