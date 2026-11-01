import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 * Builds and starts the production server so E2E tests exercise Helmet and the
 * same static/API path used in deployment.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run build && GEMINI_API_KEY=e2e-test-key FIREBASE_API_KEY=e2e-firebase-key FIREBASE_AUTH_DOMAIN=e2e.local FIREBASE_PROJECT_ID=e2e-project FIREBASE_STORAGE_BUCKET=e2e.local FIREBASE_MESSAGING_SENDER_ID=e2e-sender FIREBASE_APP_ID=e2e-app USE_IN_MEMORY_STORE=true PORT=3001 npm start',
    url: 'http://localhost:3001/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
