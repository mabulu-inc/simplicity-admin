import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			'@simplicity-admin/ui': path.resolve(__dirname, 'src/lib/index.ts'),
			'@simplicity-admin/core': path.resolve(__dirname, '../core/src/index.ts'),
		},
		conditions: ['browser'],
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'jsdom',
	},
});
