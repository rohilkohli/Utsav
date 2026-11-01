import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Utsav landing page.
 * Validates that the app loads, key headings are present, and
 * the primary CTA (Start Planning) is accessible.
 */
test.describe('Landing Page', () => {
  test('loads and displays the app title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Utsav/i);
  });

  test('shows the Start Planning CTA button', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('button', { name: /start planning/i }).first();
    await expect(cta).toBeVisible();
  });

  test('displays event type options (Wedding, Birthday, Community)', async ({ page }) => {
    await page.goto('/');
    // The hero or intro section should mention the event types
    const body = await page.textContent('body');
    expect(body).toMatch(/wedding/i);
    expect(body).toMatch(/birthday/i);
    expect(body).toMatch(/community/i);
  });
});
