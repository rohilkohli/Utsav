// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiParseIntake } from '../lib/api';
import { DescribeEvent } from '../components/wizard/DescribeEvent';
import { input } from './aiFixtures';

vi.mock('../lib/api', () => ({ apiParseIntake: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiParseIntake).mockResolvedValue(input);
});

describe('free-text celebration intake', () => {
  it('fills a validated description with the AI response', async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    render(<DescribeEvent onApply={apply} onInstantCreate={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Fill from description' })).toBeDisabled();
    await user.type(
      screen.getByLabelText('Your celebration description'),
      'Birthday in Mumbai, 50 guests',
    );
    await user.click(screen.getByRole('button', { name: 'Fill from description' }));
    await waitFor(() => {
      expect(apply).toHaveBeenCalledWith(input);
    });
  });

  it('falls back locally when AI fails and creates instantly without an HTTP request', async () => {
    vi.mocked(apiParseIntake).mockRejectedValue(new Error('offline'));
    const apply = vi.fn();
    const create = vi.fn();
    const user = userEvent.setup();
    render(<DescribeEvent onApply={apply} onInstantCreate={create} />);
    await user.type(
      screen.getByLabelText('Your celebration description'),
      'Birthday in Mumbai, 45 guests, budget 40k',
    );
    await user.click(screen.getByRole('button', { name: 'Fill from description' }));
    await waitFor(() => {
      expect(apply).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'birthday',
          city: 'Mumbai',
          guestCount: 45,
          totalBudget: 40000,
        }),
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent('built-in intake parser');
    vi.mocked(apiParseIntake).mockClear();
    await user.click(screen.getByRole('button', { name: 'Instant create' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'birthday', guestCount: 45 }),
    );
    expect(apiParseIntake).not.toHaveBeenCalled();
  });

  it('does not apply a canceled or replaced response', async () => {
    let resolve: (value: typeof input) => void = () => undefined;
    vi.mocked(apiParseIntake).mockImplementation(
      () =>
        new Promise((resolvePromise) => {
          resolve = resolvePromise;
        }),
    );
    const apply = vi.fn();
    const user = userEvent.setup();
    render(<DescribeEvent onApply={apply} onInstantCreate={() => undefined} />);
    await user.type(screen.getByLabelText('Your celebration description'), 'Birthday in Mumbai');
    await user.click(screen.getByRole('button', { name: 'Fill from description' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      resolve(input);
      await Promise.resolve();
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('preserves the description when local creation fails', async () => {
    const user = userEvent.setup();
    render(
      <DescribeEvent
        onApply={() => undefined}
        onInstantCreate={() => Promise.reject(new Error('failed'))}
      />,
    );
    await user.type(screen.getByLabelText('Your celebration description'), 'Birthday in Mumbai');
    await user.click(screen.getByRole('button', { name: 'Instant create' }));
    expect(await screen.findByText(/The plan could not be created/)).toBeVisible();
    expect(screen.getByLabelText('Your celebration description')).toHaveValue('Birthday in Mumbai');
  });
});
