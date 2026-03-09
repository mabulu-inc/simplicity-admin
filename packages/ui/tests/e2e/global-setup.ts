import { createPool, bootstrap } from '@simplicity-admin/db';
import { defineConfig } from '@simplicity-admin/core';
import bcrypt from 'bcrypt';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

export default async function globalSetup() {
	const config = defineConfig({ database: TEST_URL, systemSchema: 'simplicity_admin' });
	const pool = createPool(TEST_URL);
	try {
		await bootstrap(pool, config);
		await seedTestData(pool);
	} finally {
		await pool.end();
	}
}

async function seedTestData(pool: ReturnType<typeof createPool>) {
	// Create a contacts table in the public schema for list-view E2E tests
	await pool.query(`
		CREATE TABLE IF NOT EXISTS public.contacts (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			first_name text NOT NULL,
			last_name text NOT NULL,
			email text NOT NULL,
			status text NOT NULL DEFAULT 'draft',
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`);

	// Ensure status column exists (idempotent for pre-existing tables)
	await pool.query(`
		ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
	`);

	// Seed test contacts (idempotent)
	await pool.query(`
		INSERT INTO public.contacts (first_name, last_name, email)
		SELECT first_name, last_name, email
		FROM (VALUES
			('Alice', 'Smith', 'alice@example.com'),
			('Bob', 'Jones', 'bob@example.com'),
			('Carol', 'Williams', 'carol@example.com'),
			('Dave', 'Brown', 'dave@example.com'),
			('Eve', 'Davis', 'eve@example.com'),
			('Frank', 'Miller', 'frank@example.com'),
			('Grace', 'Wilson', 'grace@example.com'),
			('Hank', 'Moore', 'hank@example.com'),
			('Ivy', 'Taylor', 'ivy@example.com'),
			('Jack', 'Anderson', 'jack@example.com')
		) AS t(first_name, last_name, email)
		WHERE NOT EXISTS (SELECT 1 FROM public.contacts LIMIT 1);
	`);

	// Create workflow tables (state machines, transition log, automations, automation log)
	await pool.query(`
		CREATE TABLE IF NOT EXISTS public.simplicity_state_machines (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			table_name text NOT NULL,
			column_name text NOT NULL,
			states jsonb NOT NULL DEFAULT '[]',
			transitions jsonb NOT NULL DEFAULT '[]',
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_state_machines_table ON public.simplicity_state_machines (table_name);
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS public.simplicity_transition_log (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			table_name text NOT NULL,
			record_id text NOT NULL,
			from_state text NOT NULL,
			to_state text NOT NULL,
			user_id uuid,
			comment text,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS idx_transition_log_record ON public.simplicity_transition_log (table_name, record_id);
		CREATE INDEX IF NOT EXISTS idx_transition_log_created ON public.simplicity_transition_log (created_at);
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS public.simplicity_automations (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			name text NOT NULL,
			enabled boolean NOT NULL DEFAULT true,
			trigger jsonb NOT NULL DEFAULT '{}',
			conditions jsonb NOT NULL DEFAULT '[]',
			actions jsonb NOT NULL DEFAULT '[]',
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS public.simplicity_automation_log (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			automation_id uuid,
			automation_name text NOT NULL,
			status text NOT NULL,
			duration_ms integer,
			errors jsonb,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`);

	// Grant workflow table access to roles
	await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.simplicity_state_machines TO app_admin`);
	await pool.query(`GRANT SELECT ON public.simplicity_state_machines TO app_viewer, app_editor`);
	await pool.query(`GRANT SELECT, INSERT ON public.simplicity_transition_log TO app_admin, app_editor`);
	await pool.query(`GRANT SELECT ON public.simplicity_transition_log TO app_viewer`);
	await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.simplicity_automations TO app_admin`);
	await pool.query(`GRANT SELECT ON public.simplicity_automations TO app_viewer, app_editor`);
	await pool.query(`GRANT SELECT, INSERT ON public.simplicity_automation_log TO app_admin`);

	// Grant public schema usage to roles
	await pool.query(`GRANT USAGE ON SCHEMA public TO app_viewer, app_editor, app_admin`);

	// Grant app_admin full access on contacts
	await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO app_admin`);

	// Grant app_viewer SELECT on specific columns only (no created_at)
	await pool.query(`GRANT SELECT (id, first_name, last_name, email) ON public.contacts TO app_viewer`);

	// Grant app_editor SELECT on all columns, INSERT/UPDATE on data columns (not created_at)
	await pool.query(`GRANT SELECT ON public.contacts TO app_editor`);
	await pool.query(`GRANT INSERT (first_name, last_name, email) ON public.contacts TO app_editor`);
	await pool.query(`GRANT UPDATE (first_name, last_name, email) ON public.contacts TO app_editor`);

	// Create test viewer and editor users (idempotent)
	const passwordHash = await bcrypt.hash('changeme', 12);

	await pool.query(`
		INSERT INTO "simplicity_admin".users (email, password_hash, super_admin)
		VALUES ('viewer@localhost', $1, false)
		ON CONFLICT (email) DO NOTHING;
	`, [passwordHash]);

	await pool.query(`
		INSERT INTO "simplicity_admin".users (email, password_hash, super_admin)
		VALUES ('editor@localhost', $1, false)
		ON CONFLICT (email) DO NOTHING;
	`, [passwordHash]);

	// Create memberships for viewer and editor (linked to default tenant)
	await pool.query(`
		INSERT INTO "simplicity_admin".memberships (user_id, tenant_id, role)
		SELECT u.id, t.id, 'app_viewer'
		FROM "simplicity_admin".users u, "simplicity_admin".tenants t
		WHERE u.email = 'viewer@localhost' AND t.slug = 'default'
		AND NOT EXISTS (
			SELECT 1 FROM "simplicity_admin".memberships m
			WHERE m.user_id = u.id AND m.tenant_id = t.id AND m.role = 'app_viewer'
		);
	`);

	await pool.query(`
		INSERT INTO "simplicity_admin".memberships (user_id, tenant_id, role)
		SELECT u.id, t.id, 'app_editor'
		FROM "simplicity_admin".users u, "simplicity_admin".tenants t
		WHERE u.email = 'editor@localhost' AND t.slug = 'default'
		AND NOT EXISTS (
			SELECT 1 FROM "simplicity_admin".memberships m
			WHERE m.user_id = u.id AND m.tenant_id = t.id AND m.role = 'app_editor'
		);
	`);
}
