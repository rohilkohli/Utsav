import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { fetchRuntimeConfig } from './api.js';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export async function initFirebase(): Promise<Auth | null> {
  if (auth) return auth;

  try {
    const config = await fetchRuntimeConfig();
    if (!config.firebase.apiKey || config.firebase.apiKey.startsWith('your-')) {
      // Firebase not configured; guest mode will be used seamlessly
      return null;
    }

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
  const authInstance = await initFirebase();
  if (!authInstance) {
    throw new Error('Google Sign-in is not configured. You can continue using guest mode!');
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  initFirebase().then((authInstance) => {
    if (authInstance) {
      unsubscribe = onAuthStateChanged(authInstance, callback);
    } else {
      callback(null);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
