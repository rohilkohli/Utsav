import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8');
function tokens(selector: string): Record<string, string> {
  const block = css.slice(css.indexOf(selector)).split('}')[0] ?? '';
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)) {
    if (match[1] && match[2]) result[match[1]] = match[2];
  }
  return result;
}
function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722;
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}
describe('WCAG AA theme tokens', () => {
  for (const theme of ['light', 'dark']) {
    it(`${theme} text and action colors meet 4.5:1`, () => {
      const palette = {
        ...tokens(':root {'),
        ...(theme === 'dark' ? tokens(":root[data-theme='dark']") : {}),
      };
      for (const foreground of [
        '--text-main',
        '--text-muted',
        '--text-light',
        '--primary-saffron',
        '--primary-magenta',
        '--primary-emerald',
        '--primary-gold',
      ]) {
        for (const surface of ['--surface-card', '--surface-card-hover']) {
          expect(
            contrast(palette[foreground] ?? '', palette[surface] ?? ''),
            `${foreground} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const state of ['danger', 'success']) {
        expect(
          contrast(palette[`--${state}-text`] ?? '', palette[`--${state}-bg`] ?? ''),
          state,
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const action of ['saffron', 'magenta', 'emerald']) {
        expect(
          contrast('#ffffff', palette[`--action-${action}`] ?? ''),
          action,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('honors contrast and forced-color preferences without inline script', () => {
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toContain('@media (forced-colors: active)');
    const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('lang="en-IN"');
    expect(html).toContain('src="/theme-init.js"');
  });
});
