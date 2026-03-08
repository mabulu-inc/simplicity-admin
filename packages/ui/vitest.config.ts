import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	resolve: {
		alias: {
			'@simplicity-admin/ui': path.resolve(__dirname, 'src/lib/index.ts'),
			'@simplicity-admin/core': path.resolve(__dirname, '../core/src/index.ts'),
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'jsdom',
	},
});
