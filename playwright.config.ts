import { defineConfig, devices } from '@playwright/test';

const port = 3101;
const baseURL = `http://localhost:${String(port)}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm start',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
    // Test built artifacts with real security headers and explicit credential-free storage.
    // Production deployments continue to require Firestore.
    env: {
      NODE_ENV: 'development', PORT: String(port), USE_IN_MEMORY_STORE: 'true',
      GEMINI_API_KEY: 'your-gemini-api-key-here', FIREBASE_API_KEY: 'your-firebase-api-key',
      FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com', FIREBASE_PROJECT_ID: 'your-project-id',
      FIREBASE_STORAGE_BUCKET: 'your-project.appspot.com', FIREBASE_MESSAGING_SENDER_ID: '123456789',
      FIREBASE_APP_ID: '1:123456789:web:abcdef', RATE_LIMIT_MAX_REQUESTS: '1000',
    },
  },
});
