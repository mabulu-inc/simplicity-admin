import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@simplicity-admin/db': path.resolve(__dirname, 'src/index.ts'),
      '@simplicity-admin/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: [path.resolve(__dirname, '../../test-support/global-setup.ts')],
  },
});
