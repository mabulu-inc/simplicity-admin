import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    globalSetup: [path.resolve(__dirname, 'test-support/global-setup.ts')],
  },
});
