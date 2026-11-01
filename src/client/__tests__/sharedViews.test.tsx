// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanOutput, SavedPlan, WizardInput } from '@shared/schemas';
import { wizardInputSchema } from '@shared/schemas';
import { generateFallbackPlan } from '@shared/fallback';
import { Header } from '../components/shared/Header';
import { ShareModal } from '../components/shared/ShareModal';
import { SharedPlanView } from '../components/shared/SharedPlanView';

const mocks = vi.hoisted(() => ({
  token: ['snapshot'][0],
  navigate: vi.fn(),
  get: vi.fn<(token: string) => Promise<SavedPlan>>(),
  share: vi.fn<() => Promise<{ shareUrl: string; shareToken: string }>>(),
  login: vi.fn(),
  logout: vi.fn(),
  user: null as {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null,
}));
vi.mock('../lib/api', () => ({ apiGetSharedPlan: mocks.get, apiCreateShare: mocks.share }));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    isGuest: !mocks.user,
    login: mocks.login,
    logout: mocks.logout,
  }),
}));
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => ({ token: mocks.token }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../components/dashboard/DashboardShell', () => ({
  DashboardShell: ({
    input,
    readOnly,
    onNewPlan,
    onUpdatePlan,
  }: {
    input: WizardInput;
    plan: PlanOutput;
    readOnly: boolean;
    onNewPlan: () => void;
    onUpdatePlan: () => void;
  }) => (
    <main>
      <h2>{input.city}</h2>
      <p>{readOnly ? 'Snapshot cannot be edited' : 'Editable'}</p>
      <button type="button" onClick={onNewPlan}>
        Plan another event
      </button>
      <button type="button" onClick={onUpdatePlan}>
        No-op update
      </button>
    </main>
  ),
}));
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2099-12-15',
  city: 'Mumbai',
  guestCount: 45,
  totalBudget: 40000,
});
const snapshot: SavedPlan = {
  id: 'snapshot',
  input,
  plan: generateFallbackPlan(input),
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.token = 'snapshot';
  mocks.user = null;
  mocks.get.mockReset();
  mocks.navigate.mockReset();
  mocks.share.mockReset();
  mocks.logout.mockReset();
});

describe('shared snapshot boundaries', () => {
  it('shows loading and then the actual snapshot through a read-only dashboard', async () => {
    let finish: ((value: SavedPlan) => void) | undefined;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<SharedPlanView />);
    expect(screen.getByText(/Loading shared celebration/)).toBeVisible();
    finish?.(snapshot);
    expect(await screen.findByText('Mumbai')).toBeVisible();
    expect(screen.getByText('Snapshot cannot be edited')).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'No-op update' }));
    await user.click(screen.getByRole('button', { name: 'Plan another event' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });
  it('rejects missing, expired, and malformed links without exposing partial data', async () => {
    mocks.token = undefined;
    const view = render(<SharedPlanView />);
    expect(screen.getByRole('heading', { name: /Expired or Not Found/ })).toBeVisible();
    expect(mocks.get).not.toHaveBeenCalled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Plan Your Own Celebration/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/');
    mocks.token = 'expired';
    mocks.get.mockRejectedValueOnce(new Error('expired'));
    view.rerender(<SharedPlanView />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Expired or Not Found/ })).toBeVisible();
    });
    mocks.token = 'invalid';
    mocks.get.mockRejectedValueOnce('invalid');
    view.rerender(<SharedPlanView />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading shared/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Mumbai')).not.toBeInTheDocument();
  });
  it('ignores an old link response after navigation selects a newer token', async () => {
    let old: ((value: SavedPlan) => void) | undefined;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          old = resolve;
        }),
    );
    const view = render(<SharedPlanView />);
    mocks.token = 'new';
    mocks.get.mockResolvedValueOnce({ ...snapshot, input: { ...input, city: 'Pune' } });
    view.rerender(<SharedPlanView />);
    expect(await screen.findByText('Pune')).toBeVisible();
    old?.(snapshot);
    await waitFor(() => {
      expect(screen.getByText('Pune')).toBeVisible();
    });
    expect(screen.queryByText('Mumbai')).not.toBeInTheDocument();
  });
  it('ignores rejection of an old request after unmount', async () => {
    let reject: ((reason: Error) => void) | undefined;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const view = render(<SharedPlanView />);
    view.unmount();
    reject?.(new Error('gone'));
    await Promise.resolve();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});

describe('header identity and theme actions', () => {
  it('shows authenticated identity, allows a new plan and signs out', async () => {
    mocks.user = {
      displayName: 'Asha',
      email: 'asha@example.com',
      photoURL: 'https://example.com/asha.jpg',
    };
    const newPlan = vi.fn();
    const view = render(<Header onNewPlan={newPlan} showNewPlanButton />);
    expect(screen.getByRole('img', { name: 'Asha' })).toHaveAttribute(
      'referrerpolicy',
      'no-referrer',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /Plan New Event/ }));
    expect(newPlan).toHaveBeenCalledOnce();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    mocks.user = { displayName: null, email: 'asha@example.com', photoURL: null };
    view.rerender(<Header />);
    expect(screen.getByText('asha@example.com')).toBeVisible();
    mocks.user = { displayName: null, email: null, photoURL: 'https://example.com/anonymous.jpg' };
    view.rerender(<Header />);
    expect(screen.getByText('User')).toBeVisible();
    expect(screen.getByRole('img', { name: 'User profile' })).toBeVisible();
  });
  it('applies themes even when browser storage refuses writes', async () => {
    document.documentElement.dataset.theme = 'dark';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('denied');
    });
    render(<Header />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('share link delivery', () => {
  it('handles clipboard denial, retry, and WhatsApp content without losing the share', async () => {
    const user = userEvent.setup();
    mocks.share.mockResolvedValueOnce({
      shareUrl: 'https://example.com/share/snapshot',
      shareToken: 'snapshot',
    });
    const onClose = vi.fn();
    const view = render(
      <ShareModal input={input} plan={snapshot.plan} isOpen={false} onClose={onClose} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<ShareModal input={input} plan={snapshot.plan} isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /Create Read-Only Share Link/ }));
    await screen.findByRole('textbox', { name: 'Shareable link' });
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Copy is unavailable');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByRole('status')).toHaveTextContent('Share link copied');
    expect(clipboard).toHaveBeenLastCalledWith('https://example.com/share/snapshot');
    const whatsapp = screen.getByRole('link', { name: /Share via WhatsApp/ });
    expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain('Mumbai');
    expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain(
      'https://example.com/share/snapshot',
    );
    await user.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
