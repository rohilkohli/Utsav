import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/client/**', 'jsdom'],
    ],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/client/__tests__/setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 2,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts', 'src/server/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
