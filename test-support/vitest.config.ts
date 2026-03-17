import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@mabulu-inc/simplicity-admin-core': path.resolve(__dirname, '../packages/core/src/index.ts'),
      '@mabulu-inc/simplicity-admin-db': path.resolve(__dirname, '../packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['src/__tests__/*.test.ts'],
    globalSetup: [path.resolve(__dirname, 'src/global-setup.ts')],
  },
});
