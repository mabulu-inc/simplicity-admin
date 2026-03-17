import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@mabulu-inc/simplicity-admin-api': path.resolve(__dirname, 'src/index.ts'),
      '@mabulu-inc/simplicity-admin-core': path.resolve(__dirname, '../core/src/index.ts'),
      '@mabulu-inc/simplicity-admin-db': path.resolve(__dirname, '../db/src/index.ts'),
      '@mabulu-inc/simplicity-admin-test-support': path.resolve(__dirname, '../../test-support/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: [path.resolve(__dirname, '../../test-support/src/global-setup.ts')],
  },
});
