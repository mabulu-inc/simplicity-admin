import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	timeout: 30_000,
	retries: 0,
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:5173',
	},
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
