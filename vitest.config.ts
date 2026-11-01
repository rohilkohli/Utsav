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
    // 'forks' pool with singleFork avoids jsdom Worker-thread memory leaks in CI.
    // Threads share one heap and the jsdom environment accumulates until OOM after ~5h.
    // A single forked process runs tests sequentially in its own address space.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // After all tests complete, wait at most 5 s for open handles (e.g. Firebase
    // gRPC keep-alive connections) before force-exiting — prevents 20-min CI hangs.
    teardownTimeout: 5_000,
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts', 'src/server/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
