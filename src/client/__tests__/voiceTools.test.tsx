// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVoiceTools } from '../components/voice/useVoiceTools';
import { apiSearchVendors } from '../lib/api';
import { wizardInputSchema } from '@shared/schemas';
import { generateFallbackPlan } from '@shared/fallback';
vi.mock('../lib/api', () => ({ apiSearchVendors: vi.fn() }));
it('grounds voice tools in the active plan, verified vendors and supported tab names', async () => {
  const input = wizardInputSchema.parse({
    eventType: 'birthday',
    eventDate: '2030-12-15',
    city: 'Mumbai',
    guestCount: 45,
    totalBudget: 40000,
  });
  const plan = generateFallbackPlan(input);
  const onNavigateTab = vi.fn();
  const hook = renderHook(() => useVoiceTools({ plan, input, onNavigateTab }));
  expect(await hook.result.current('get_celebration_plan', {})).toContain('40000');
  vi.mocked(apiSearchVendors).mockResolvedValue([{ name: 'Verified Caterer' }]);
  expect(await hook.result.current('search_vendors', { category: 'food', city: 'Pune' })).toContain(
    'Verified Caterer',
  );
  expect(apiSearchVendors).toHaveBeenLastCalledWith('food', 'Pune');
  vi.mocked(apiSearchVendors).mockResolvedValue([]);
  expect(await hook.result.current('search_vendors', {})).toContain('No verified vendors');
  expect(apiSearchVendors).toHaveBeenLastCalledWith('', 'Mumbai');
  vi.mocked(apiSearchVendors).mockRejectedValue(new Error('offline'));
  expect(await hook.result.current('search_vendors', {})).toContain('unavailable');
  for (const tab of ['budget', 'timeline', 'vendors', 'ideas', 'runsheet']) {
    expect(await hook.result.current('navigate_to_tab', { tab })).toBe(`Opened ${tab}.`);
    expect(onNavigateTab).toHaveBeenLastCalledWith(tab);
  }
  expect(await hook.result.current('navigate_to_tab', {})).toBe('Unknown dashboard tab.');
  expect(await hook.result.current('navigate_to_tab', { tab: 'invalid' })).toBe(
    'Unknown dashboard tab.',
  );
  expect(await hook.result.current('invalid', {})).toBe('Unknown tool.');
  const empty = renderHook(() => useVoiceTools({}));
  expect(await empty.result.current('get_celebration_plan', {})).toContain('No plan yet');
  expect(await empty.result.current('navigate_to_tab', { tab: 'budget' })).toBe('Opened budget.');
  vi.mocked(apiSearchVendors).mockResolvedValue([]);
  await empty.result.current('search_vendors', {});
  expect(apiSearchVendors).toHaveBeenLastCalledWith('', '');
});
