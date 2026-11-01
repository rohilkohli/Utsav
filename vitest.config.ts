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
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/client/__tests__/setup.ts'],
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // After all tests complete, wait at most 5 s for open handles (e.g. Firebase
    // gRPC keep-alive connections) before force-exiting — prevents 20-min CI hangs.
    teardownTimeout: 5_000,
    coverage: {
      provider: 'v8',
      include: ['src/client/**/*.{ts,tsx}', 'src/shared/**/*.ts', 'src/server/**/*.ts'],
      exclude: ['src/client/main.tsx', '**/__tests__/**', '**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
        'src/shared/**/*.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
