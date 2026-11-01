// @vitest-environment jsdom
import type { Auth, User } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('../lib/api', () => ({ fetchRuntimeConfig: mocks.config }));
vi.mock('firebase/app', () => ({ getApps: mocks.getApps, initializeApp: mocks.initializeApp }));
vi.mock('firebase/auth', () => ({
  getAuth: mocks.getAuth,
  signInWithPopup: mocks.signInWithPopup,
  signOut: mocks.signOut,
  onAuthStateChanged: mocks.onAuthStateChanged,
  GoogleAuthProvider: vi.fn(function () {
    return {};
  }),
}));

const fakeApp: FirebaseApp = {
  name: 'utsav-test',
  options: { apiKey: 'public' },
  automaticDataCollectionEnabled: false,
};
const fakeAuth = { app: fakeApp } as Auth;
const fakeUser = { uid: 'user-1' } as User;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  localStorage.clear();
  mocks.config.mockResolvedValue({
    firebase: { apiKey: 'configured-public-key', authDomain: 'utsav.example', projectId: 'utsav' },
  });
  mocks.getApps.mockReturnValue([]);
  mocks.initializeApp.mockReturnValue(fakeApp);
  mocks.getAuth.mockReturnValue(fakeAuth);
  mocks.signInWithPopup.mockResolvedValue({ user: fakeUser });
  mocks.signOut.mockResolvedValue(undefined);
  mocks.onAuthStateChanged.mockReturnValue(mocks.unsubscribe);
});

describe('lazy Firebase authentication', () => {
  it('leaves guests SDK-free until authentication is requested', async () => {
    const firebase = await import('../lib/firebase');
    const listener = vi.fn();
    const unsubscribe = firebase.subscribeToAuthChanges(listener);
    expect(listener).toHaveBeenCalledWith(null);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    unsubscribe();
    await firebase.logoutUser();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each(['', 'your-firebase-api-key'])(
    'treats placeholder configuration as guest mode: %s',
    async (key) => {
      mocks.config.mockResolvedValue({ firebase: { apiKey: key } });
      const firebase = await import('../lib/firebase');
      expect(await firebase.initFirebase()).toBeNull();
      await expect(firebase.loginWithGoogle()).rejects.toThrow('Google Sign-in is not configured');
      expect(localStorage.getItem('utsav_has_auth')).toBeNull();
      expect(mocks.getAuth).not.toHaveBeenCalled();
    },
  );

  it('falls back safely when public configuration cannot be loaded', async () => {
    mocks.config.mockRejectedValue(new Error('offline'));
    const firebase = await import('../lib/firebase');
    expect(await firebase.initFirebase()).toBeNull();
    localStorage.setItem('utsav_has_auth', 'true');
    const callback = vi.fn();
    firebase.subscribeToAuthChanges(callback);
    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  it('initializes once, signs in with Google, and clears remembered authentication on sign out', async () => {
    const firebase = await import('../lib/firebase');
    expect(await firebase.initFirebase()).toBe(fakeAuth);
    expect(await firebase.initFirebase()).toBe(fakeAuth);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(await firebase.loginWithGoogle()).toBe(fakeUser);
    expect(localStorage.getItem('utsav_has_auth')).toBe('true');
    await firebase.logoutUser();
    expect(localStorage.getItem('utsav_has_auth')).toBeNull();
    expect(mocks.signOut).toHaveBeenCalledWith(fakeAuth);
  });

  it('reuses an existing app and forwards SDK authentication changes with cleanup', async () => {
    mocks.getApps.mockReturnValue([fakeApp]);
    localStorage.setItem('utsav_has_auth', 'true');
    const firebase = await import('../lib/firebase');
    const callback = vi.fn();
    let listener: ((user: User | null) => void) | undefined;
    mocks.onAuthStateChanged.mockImplementation(
      (_auth: unknown, onChange: (user: User | null) => void) => {
        listener = onChange;
        return mocks.unsubscribe;
      },
    );
    const cleanup = firebase.subscribeToAuthChanges(callback);
    await waitFor(() => {
      expect(mocks.onAuthStateChanged).toHaveBeenCalled();
    });
    listener?.(fakeUser);
    expect(callback).toHaveBeenCalledWith(fakeUser);
    listener?.(null);
    expect(localStorage.getItem('utsav_has_auth')).toBeNull();
    cleanup();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });

  it('does not subscribe or call back after unmount while initialization is pending', async () => {
    let resolve: (value: { firebase: { apiKey: string } }) => void = () => undefined;
    mocks.config.mockImplementation(
      () =>
        new Promise((resolvePromise) => {
          resolve = resolvePromise;
        }),
    );
    localStorage.setItem('utsav_has_auth', 'true');
    const firebase = await import('../lib/firebase');
    const callback = vi.fn();
    const cleanup = firebase.subscribeToAuthChanges(callback);
    cleanup();
    resolve({ firebase: { apiKey: 'configured' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChanged).not.toHaveBeenCalled();
  });

  it('recovers if the authentication listener fails to initialize', async () => {
    mocks.onAuthStateChanged.mockImplementation(() => {
      throw new Error('SDK failure');
    });
    localStorage.setItem('utsav_has_auth', 'true');
    const firebase = await import('../lib/firebase');
    const callback = vi.fn();
    firebase.subscribeToAuthChanges(callback);
    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(null);
    });
  });
});
