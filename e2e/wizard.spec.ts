import { test, expect } from '@playwright/test';

/**
 * E2E tests for the event wizard flow.
 * Covers navigation through wizard steps, form field interaction,
 * and accessibility of the planning wizard without requiring auth.
 */
test.describe('Event Planning Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking Start Planning opens the wizard', async ({ page }) => {
    const cta = page.getByRole('button', { name: /start planning/i }).first();
    await cta.click();
    // Should render wizard step 1 (event type selection)
    const wizard = page.getByRole('main').or(page.locator('[data-testid="wizard"]')).first();
    await expect(wizard).toBeVisible();
  });

  test('wizard renders event type selection step', async ({ page }) => {
    const cta = page.getByRole('button', { name: /start planning/i }).first();
    await cta.click();
    // Step 1 should show Wedding option
    const body = await page.textContent('body');
    expect(body).toMatch(/wedding|birthday|community/i);
  });

  test('page has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Filter out known benign third-party errors
    const appErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('firebase') && !e.includes('ERR_BLOCKED'),
    );
    expect(appErrors).toHaveLength(0);
  });
});
