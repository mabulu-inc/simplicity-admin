import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@simplicity-admin/auth': path.resolve(__dirname, 'src/index.ts'),
      '@simplicity-admin/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@simplicity-admin/db': path.resolve(__dirname, '../db/src/index.ts'),
      '@simplicity-admin/test-support': path.resolve(__dirname, '../../test-support/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: [path.resolve(__dirname, '../../test-support/src/global-setup.ts')],
  },
});
