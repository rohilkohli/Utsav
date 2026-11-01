// @vitest-environment jsdom
import type { User } from 'firebase/auth';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../components/auth/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { loginWithGoogle, logoutUser, subscribeToAuthChanges } from '../lib/firebase';

vi.mock('../lib/firebase', () => ({
  loginWithGoogle: vi.fn(),
  logoutUser: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}));
const user = { uid: 'user-1' } as User;
let notify: (user: User | null) => void = () => undefined;
const unsubscribe = vi.fn();
function Consumer() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.loading ? 'Loading' : auth.isGuest ? 'Guest' : auth.user?.uid}</span>
      <button
        type="button"
        onClick={() => {
          void auth.login();
        }}
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.logout();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(subscribeToAuthChanges).mockImplementation((callback) => {
    notify = callback;
    return unsubscribe;
  });
  vi.mocked(loginWithGoogle).mockResolvedValue(user);
  vi.mocked(logoutUser).mockResolvedValue(undefined);
});

describe('authentication provider', () => {
  it('follows guest and signed-in state, supports login/logout and unsubscribes on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByText('Loading')).toBeVisible();
    act(() => {
      notify(null);
    });
    expect(screen.getByText('Guest')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('user-1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Guest')).toBeVisible();
    expect(logoutUser).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps guest planning available when login fails', async () => {
    vi.mocked(loginWithGoogle).mockRejectedValue(new Error('offline'));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    act(() => {
      notify(null);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(loginWithGoogle).toHaveBeenCalled();
    });
    expect(screen.getByText('Guest')).toBeVisible();
    act(() => {
      notify(user);
    });
    expect(screen.getByText('user-1')).toBeVisible();
  });
});
