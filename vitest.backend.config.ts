import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/backend/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/', 'tests/e2e/**', 'tests/frontend/**'],
    setupFiles: ['./tests/setup/backend-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './server'),
      '@shared': resolve(__dirname, './shared'),
    },
  },
});
