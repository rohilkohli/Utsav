// @vitest-environment jsdom
import { createRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WizardShell } from '../components/wizard/WizardShell';
import { VoicePanel } from '../components/voice/VoicePanel';
import { ShareModal } from '../components/shared/ShareModal';
import { Header } from '../components/shared/Header';
import { generateFallbackPlan } from '../../shared/fallback';
import { wizardInputSchema } from '../../shared/schemas';

const spies = vi.hoisted(() => ({ share: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isGuest: true, login: spies.login, logout: spies.logout }),
}));
vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  apiCreateShare: spies.share,
}));
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2099-12-15',
  city: 'Mumbai',
  guestCount: 45,
  totalBudget: 40000,
});

function VoiceHarness() {
  const [open, setOpen] = useState(false);
  return (
    <VoicePanel
      isOpen={open}
      status="idle"
      messages={[]}
      transcriptRef={createRef<HTMLDivElement>()}
      canConnect
      micVolume={0}
      onToggle={() => {
        setOpen(!open);
      }}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
    />
  );
}
function ShareHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Share plan
      </button>
      <ShareModal
        input={input}
        plan={generateFallbackPlan(input)}
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

describe('accessible dialogs, form errors and themes', () => {
  it('focuses and links wizard validation errors without silently disabling Continue', async () => {
    const user = userEvent.setup();
    render(<WizardShell onGeneratePlan={vi.fn()} isGenerating={false} />);
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.clear(screen.getByLabelText('Host City in India:'));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText('Host City in India:')).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('link', { name: /city is required/i }));
    expect(screen.getByLabelText('Host City in India:')).toHaveFocus();
    await user.type(screen.getByLabelText('Host City in India:'), 'Mumbai');
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByLabelText(/Total Budget in Indian Rupees/)).toBeVisible();
  });

  it('rejects invalid budgets, accepts Indian amount inputs, and focuses the budget field', async () => {
    const user = userEvent.setup();
    render(<WizardShell onGeneratePlan={vi.fn()} isGenerating={false} />);
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    const budget = screen.getByLabelText(/Total Budget in Indian Rupees/);
    await user.clear(budget);
    await user.type(budget, 'nonsense');
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(budget).toHaveAttribute('aria-invalid', 'true');
    await user.clear(budget);
    await user.type(budget, '8.5 lakh');
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByLabelText('Theme / Aesthetic Vibe:')).toBeVisible();
  });

  it('traps voice focus, supports Escape, and restores the launcher', async () => {
    const user = userEvent.setup();
    render(<VoiceHarness />);
    const trigger = screen.getByRole('button', { name: 'Open Utsav Voice Agent' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Utsav Voice' })).toBeVisible();
    const close = screen.getByRole('button', { name: 'Close voice agent' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: /Connect & Talk/ })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Utsav Voice Agent' })).toHaveFocus();
  });

  it('keeps failed share generation recoverable and restores focus on close', async () => {
    const user = userEvent.setup();
    spies.share
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ shareUrl: 'https://example.com/share/snapshot' });
    render(<ShareHarness />);
    await user.click(screen.getByRole('button', { name: 'Share plan' }));
    const close = screen.getByRole('button', { name: 'Close share dialog' });
    expect(close).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /Create Read-Only Share Link/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create/);
    await user.click(screen.getByRole('button', { name: /Create Read-Only Share Link/ }));
    expect(await screen.findByRole('textbox', { name: 'Shareable link' })).toHaveValue(
      'https://example.com/share/snapshot',
    );
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Share plan' })).toHaveFocus();
  });

  it('toggles the visible and persisted theme and keeps login usable', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'light';
    render(<Header />);
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('utsav-theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(screen.getByRole('button', { name: /Guest Mode/ }));
    await waitFor(() => {
      expect(spies.login).toHaveBeenCalled();
    });
  });
});
