// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ConnectionPool } from '@simplicity-admin/core';
import { executeWidgetQuery } from '../../src/lib/dashboards/manager.js';
import type { Widget } from '../../src/lib/dashboards/types.js';
import { createTestDb, destroyTestDb, type TestDb } from '@simplicity-admin/test-support';

describe('Widget Execution Engine (integration)', () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();

		// Create test tables
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

		// Create a test data table for widget queries
		await testDb.pool.query(`
			CREATE TABLE IF NOT EXISTS widget_test_contacts (
				id serial PRIMARY KEY,
				name text NOT NULL,
				email text NOT NULL,
				tenant_id text
			)
		`);

		await testDb.pool.query(`
			INSERT INTO widget_test_contacts (name, email, tenant_id) VALUES
			('Alice', 'alice@example.com', 'tenant-a'),
			('Bob', 'bob@example.com', 'tenant-a'),
			('Charlie', 'charlie@example.com', 'tenant-b')
		`);
	});

	afterAll(async () => {
		await destroyTestDb(testDb);
	});

	describe('Stat widget query', () => {
		it('returns a single value', async () => {
			const widget: Widget = {
				id: 'stat-1',
				type: 'stat',
				title: 'Total Contacts',
				config: {
					query: 'SELECT COUNT(*) AS value FROM widget_test_contacts',
					format: 'number',
				},
			};

			const result = await executeWidgetQuery(testDb.pool, widget);
			expect(result).toEqual({ value: 3 });
		});
	});

	describe('Table widget query', () => {
		it('returns rows', async () => {
			const widget: Widget = {
				id: 'table-1',
				type: 'table',
				title: 'Contacts',
				config: {
					query: 'SELECT name, email FROM widget_test_contacts ORDER BY name',
					columns: [
						{ key: 'name', label: 'Name' },
						{ key: 'email', label: 'Email' },
					],
				},
			};

			const result = await executeWidgetQuery(testDb.pool, widget);
			expect(result).toEqual([
				{ name: 'Alice', email: 'alice@example.com' },
				{ name: 'Bob', email: 'bob@example.com' },
				{ name: 'Charlie', email: 'charlie@example.com' },
			]);
		});
	});

	describe('Chart widget query', () => {
		it('returns label/value pairs', async () => {
			const widget: Widget = {
				id: 'chart-1',
				type: 'chart',
				title: 'Contacts by Tenant',
				config: {
					type: 'bar',
					query: 'SELECT tenant_id AS label, COUNT(*) AS value FROM widget_test_contacts GROUP BY tenant_id ORDER BY tenant_id',
				},
			};

			const result = await executeWidgetQuery(testDb.pool, widget);
			expect(result).toEqual([
				{ label: 'tenant-a', value: 2 },
				{ label: 'tenant-b', value: 1 },
			]);
		});
	});

	describe('RLS enforcement (tenant isolation)', () => {
		it('sets tenant context via set_config when tenantId is provided', async () => {
			const widget: Widget = {
				id: 'stat-rls',
				type: 'stat',
				title: 'Tenant Check',
				config: {
					query: "SELECT current_setting('app.tenant_id', true) AS value",
					format: 'number',
				},
			};

			const result = await executeWidgetQuery(testDb.pool, widget, 'tenant-a');
			expect(result).toEqual({ value: 'tenant-a' });
		});

		it('filters data when RLS policy is active', async () => {
			await testDb.pool.query(`
				DO $$ BEGIN
					IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_role') THEN
						CREATE ROLE rls_test_role;
					END IF;
				END $$
			`);
			await testDb.pool.query(`GRANT SELECT ON widget_test_contacts TO rls_test_role`);

			await testDb.pool.query(`ALTER TABLE widget_test_contacts ENABLE ROW LEVEL SECURITY`);
			await testDb.pool.query(`
				DO $$ BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM pg_policies WHERE tablename = 'widget_test_contacts' AND policyname = 'tenant_isolation'
					) THEN
						EXECUTE 'CREATE POLICY tenant_isolation ON widget_test_contacts FOR SELECT
							USING (tenant_id = current_setting(''app.tenant_id'', true))';
					END IF;
				END $$
			`);

			const result = await testDb.pool.withClient(async (client) => {
				const pgClient = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
				await pgClient.query('BEGIN');
				await pgClient.query("SELECT set_config('app.tenant_id', $1, true)", ['tenant-a']);
				await pgClient.query('SET LOCAL ROLE rls_test_role');
				const res = await pgClient.query('SELECT COUNT(*)::int AS value FROM widget_test_contacts');
				await pgClient.query('ROLLBACK');
				return res.rows[0];
			});

			expect(result).toEqual({ value: 2 });

			await testDb.pool.query(`DROP POLICY IF EXISTS tenant_isolation ON widget_test_contacts`);
			await testDb.pool.query(`ALTER TABLE widget_test_contacts DISABLE ROW LEVEL SECURITY`);
			await testDb.pool.query(`REVOKE SELECT ON widget_test_contacts FROM rls_test_role`);
		});
	});

	describe('Non-SELECT query rejection', () => {
		it('rejects INSERT queries', async () => {
			const widget: Widget = {
				id: 'bad-1',
				type: 'stat',
				title: 'Bad Widget',
				config: {
					query: "INSERT INTO widget_test_contacts (name, email) VALUES ('Evil', 'evil@test.com')",
					format: 'number',
				},
			};

			await expect(executeWidgetQuery(testDb.pool, widget)).rejects.toThrow(/only SELECT/i);
		});

		it('rejects UPDATE queries', async () => {
			const widget: Widget = {
				id: 'bad-2',
				type: 'stat',
				title: 'Bad Widget',
				config: {
					query: "UPDATE widget_test_contacts SET name = 'hacked'",
					format: 'number',
				},
			};

			await expect(executeWidgetQuery(testDb.pool, widget)).rejects.toThrow(/only SELECT/i);
		});

		it('rejects DELETE queries', async () => {
			const widget: Widget = {
				id: 'bad-3',
				type: 'stat',
				title: 'Bad Widget',
				config: {
					query: 'DELETE FROM widget_test_contacts',
					format: 'number',
				},
			};

			await expect(executeWidgetQuery(testDb.pool, widget)).rejects.toThrow(/only SELECT/i);
		});

		it('rejects DROP queries', async () => {
			const widget: Widget = {
				id: 'bad-4',
				type: 'stat',
				title: 'Bad Widget',
				config: {
					query: 'DROP TABLE widget_test_contacts',
					format: 'number',
				},
			};

			await expect(executeWidgetQuery(testDb.pool, widget)).rejects.toThrow(/only SELECT/i);
		});
	});
});
