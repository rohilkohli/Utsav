import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createPlan, noOverflow } from './helpers';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
test.use({
  launchOptions: {
    ...(executablePath ? { executablePath } : {}),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});
for (const theme of ['light', 'dark']) {
  test(`${theme} connected voice tool transcript meets WCAG AA`, async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.addInitScript((value) => {
      localStorage.setItem('utsav-theme', value);
    }, theme);
    await page.routeWebSocket('**/api/voice/ws', (route) => {
      route.onMessage((message) => {
        if (typeof message !== 'string') return;
        const payload: unknown = JSON.parse(message);
        if (typeof payload === 'object' && payload !== null && 'setup' in payload) {
          route.send(JSON.stringify({ setupComplete: {} }));
          route.send(
            JSON.stringify({
              toolCall: {
                functionCalls: [{ id: 'plan-facts', name: 'get_celebration_plan', args: {} }],
              },
            }),
          );
          route.send(
            JSON.stringify({
              serverContent: {
                outputTranscription: { text: 'Your celebration facts are ready.' },
                turnComplete: true,
              },
            }),
          );
        }
      });
    });
    await createPlan(page);
    await page.getByRole('button', { name: 'Open Utsav Voice Agent' }).click();
    await page.getByRole('button', { name: /Connect & Talk/ }).click();
    await expect(page.getByText('🔧 get_celebration_plan', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Your celebration facts are ready.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await noOverflow(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: /End Call/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open Utsav Voice Agent' })).toBeFocused();
  });
}
