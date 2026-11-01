import { expect, type Page } from '@playwright/test';

export const tabs = ['Budget Planner', 'Timeline & Milestones', 'Vendor Checklist', 'Personalized Ideas', 'Day-of Run Sheet'];
export async function createPlan(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: /Birthday \/ Milestone/ }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.locator('#event-date').fill(new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
  await page.locator('#event-city').fill('Mumbai');
  await page.getByRole('spinbutton', { name: 'Exact guest count' }).fill('45');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.locator('#total-budget-input').fill('40000');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.locator('#theme-input').fill('Marigold birthday');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('button', { name: '✨ Generate Celebration Plan' }).click();
  await expect(page.getByRole('tab', { name: 'Budget Planner', exact: true })).toBeVisible();
}
export async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tabpanel', { name, exact: true })).toBeVisible();
}
export async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
