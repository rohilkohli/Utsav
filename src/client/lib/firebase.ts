import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import { fetchRuntimeConfig } from './api.js';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Lazily loads Firebase App and Auth SDKs only when needed.
 * Guests who do not click Sign In will NEVER download the Firebase SDK.
 */
export async function initFirebase(): Promise<Auth | null> {
  if (auth) return auth;

  try {
    const config = await fetchRuntimeConfig();
    if (!config.firebase.apiKey || config.firebase.apiKey.startsWith('your-')) {
      // Firebase not configured; guest mode will be used seamlessly
      return null;
    }

    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');

    if (!getApps().length) {
      app = initializeApp(config.firebase);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    return auth;
  } catch {
    return null;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('utsav_has_auth', 'true');
  }
  const authInstance = await initFirebase();
  if (!authInstance) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('utsav_has_auth');
    }
    throw new Error('Google Sign-in is not configured. You can continue using guest mode!');
  }
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('utsav_has_auth');
  }
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  // If visitor is a guest who has never authenticated, avoid downloading Firebase
  const hasPreviousSession =
    typeof window !== 'undefined' && localStorage.getItem('utsav_has_auth') === 'true';

  if (!hasPreviousSession) {
    callback(null);
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;
  initFirebase().then(async (authInstance) => {
    if (authInstance) {
      const { onAuthStateChanged } = await import('firebase/auth');
      unsubscribe = onAuthStateChanged(authInstance, (u) => {
        if (!u && typeof window !== 'undefined') {
          localStorage.removeItem('utsav_has_auth');
        }
        callback(u);
      });
    } else {
      callback(null);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
