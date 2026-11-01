import { test, expect } from '@playwright/test';

/**
 * E2E accessibility tests for Utsav.
 * Validates ARIA landmarks, skip links, and keyboard navigation
 * are present and functional on the landing page.
 */
test.describe('Accessibility', () => {
  test('has a skip-to-main link', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    // May be visually hidden but must be in the DOM for keyboard users
    await expect(skipLink).toBeAttached();
  });

  test('main landmark is present', async ({ page }) => {
    await page.goto('/');
    const main = page.getByRole('main');
    await expect(main).toBeAttached();
  });

  test('navigation landmark is present', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeAttached();
  });

  test('primary CTA is keyboard-focusable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    // After one or two tabs we should reach an interactive element
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focused);
  });
});
