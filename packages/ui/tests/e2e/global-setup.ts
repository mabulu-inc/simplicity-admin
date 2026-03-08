import { createPool, bootstrap } from '@simplicity-admin/db';
import { defineConfig } from '@simplicity-admin/core';

const TEST_URL = 'postgres://simplicity:simplicity@localhost:5432/simplicity_admin';

export default async function globalSetup() {
	const config = defineConfig({ database: TEST_URL, systemSchema: 'simplicity_admin' });
	const pool = createPool(TEST_URL);
	try {
		await bootstrap(pool, config);
	} finally {
		await pool.end();
	}
}
