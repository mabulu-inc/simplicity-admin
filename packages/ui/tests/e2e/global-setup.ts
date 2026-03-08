import { createPool, bootstrap } from '@simplicity-admin/db';
import { defineConfig } from '@simplicity-admin/core';

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
			created_at timestamptz NOT NULL DEFAULT now()
		);
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
}
