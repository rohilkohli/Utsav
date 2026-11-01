import { test, expect } from '@playwright/test';
import { createPlan, openTab } from './helpers';

test('wizard budget changes recalculate warnings and tradeoffs, preserving guest edits', async ({ page }) => {
  await createPlan(page);
  await page.getByRole('spinbutton', { name: 'Guest count', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: 'Per-plate cost (₹)', exact: true }).fill('1000');
  await expect(page.getByText(/Catering shortfall:/)).toBeVisible();
  const spend = page.getByRole('textbox', { name: /Actual spend for/ }).first();
  await spend.fill('60000');
  await expect(page.getByRole('alert').filter({ hasText: /Over Budget/ })).toBeVisible();
  await page.getByRole('button', { name: /Scale adjustable spending down/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Over Budget/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Guest count', exact: true })).toHaveValue('100');
});

test('dependency delays flag downstream tasks and quotations sync verified budget spending', async ({ page }) => {
  await createPlan(page);
  await openTab(page, 'Timeline & Milestones');
  await page.getByRole('spinbutton', { name: /Delay days for/ }).first().fill('20');
  await expect(page.getByText(/Pushed by delayed task:/).first()).toBeVisible();
  await openTab(page, 'Vendor Checklist');
  await page.getByText('Analyze WhatsApp or email quote', { exact: true }).first().click();
  await page.getByRole('textbox', { name: /Quote text for/ }).first().fill('Marigold Events total price ₹18000, GST included, advance 60%, cancellation non-refundable.');
  await page.getByRole('button', { name: 'Analyze quote', exact: true }).first().click();
  await expect(page.getByText(/Effective total:/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add to comparison', exact: true }).first().click();
  await page.getByRole('button', { name: /Accept quotation from/ }).first().click();
  await expect(page.getByText('Accepted quotation', { exact: true }).first()).toBeVisible();
  await openTab(page, 'Budget Planner');
  await expect(page.getByText(/Verified quotation/).first()).toBeVisible();
});

test('assistant answers live plan questions and share opens in a fresh guest context', async ({ page, browser }) => {
  await createPlan(page);
  await page.getByRole('textbox', { name: /Ask about budget/ }).fill('kharcha kitna hai?');
  await page.getByRole('button', { name: /^Ask$|Ask planner/i }).click();
  await expect(page.getByText(/Assistant \(Built-in Planner\)/).last()).toBeVisible();
  await page.getByRole('button', { name: /Ask AI for a Plan Review/ }).click();
  await expect(page.getByText(/Plan review ·/)).toBeVisible();
  await page.getByRole('button', { name: /Share Plan/ }).click();
  await page.getByRole('button', { name: /Create Read-Only Share Link/i }).click();
  const link = page.getByRole('textbox', { name: 'Shareable link' });
  await expect(link).toHaveValue(/\/share\//);
  const shareURL = await link.inputValue();
  const fresh = await browser.newContext();
  try {
    const shared = await fresh.newPage();
    await shared.goto(shareURL);
    await expect(shared.getByText(/Mumbai/).first()).toBeVisible();
    await expect(shared.getByText(/read.only/i).first()).toBeVisible();
  } finally { await fresh.close(); }
});
