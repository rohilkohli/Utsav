import { test, expect } from '@playwright/test';
import { noOverflow } from './helpers';

test('landing opens the real wizard and supplies hardened headers', async ({ page }) => {
  const response = await page.goto('/');
  await expect(page).toHaveTitle(/Utsav/);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Event Type' })).toBeVisible();
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("style-src 'self'");
  expect(headers['content-security-policy']).not.toContain('unsafe-inline');
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  await noOverflow(page);
});

test('free-text intake fills real fields and instant creation opens dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Your celebration description' }).fill('Birthday in Mumbai, 45 guests, budget 40000, theme marigold');
  await page.getByRole('button', { name: 'Fill from description' }).click();
  await expect(page.getByRole('heading', { name: 'Review & Generate Your Plan' })).toBeVisible();
  await expect(page.getByText(/🎂 Birthday \/ Milestone/)).toBeVisible();
  await expect(page.getByText('₹40,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /instant create/i }).click();
  await expect(page.getByRole('tab', { name: 'Budget Planner', exact: true })).toBeVisible();
});
