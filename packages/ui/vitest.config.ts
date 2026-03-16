import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
	plugins: [svelte({ hot: false, preprocess: [] })],
	resolve: {
		alias: {
			'@simplicity-admin/ui': path.resolve(__dirname, 'src/lib/index.ts'),
			'@simplicity-admin/core': path.resolve(__dirname, '../core/src/index.ts'),
			'@simplicity-admin/db': path.resolve(__dirname, '../db/src/index.ts'),
			'@simplicity-admin/test-support': path.resolve(__dirname, '../../test-support/src/index.ts'),
			'$lib': path.resolve(__dirname, 'src/lib'),
		},
		conditions: ['browser'],
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'jsdom',
		globalSetup: [path.resolve(__dirname, '../../test-support/src/global-setup.ts')],
	},
});
