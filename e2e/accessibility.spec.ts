import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createPlan, noOverflow, openTab, tabs } from './helpers';

for (const theme of ['light', 'dark']) {
  test(`${theme} wizard and all dashboard tabs meet WCAG AA without CSP errors or overflow`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(value => { localStorage.setItem('utsav-theme', value); }, theme);
    await page.goto('/');
    // Use the product toggle so the test also validates theme persistence.
    const current = await page.locator('html').getAttribute('data-theme');
    if (current !== theme) await page.getByRole('button', { name: `Switch to ${theme} theme` }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const audit = async () => {
      await noOverflow(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    };
    await audit();
    await createPlan(page);
    for (const tab of tabs) { await openTab(page, tab); await audit(); }
    await page.getByRole('tab', { name: 'Budget Planner', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Timeline & Milestones', exact: true })).toBeFocused();
    await page.getByRole('button', { name: /Share Plan/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Share Plan/ })).toBeFocused();
    expect(errors).toEqual([]);
  });
}
