import { describe, it, expect, afterEach } from 'vitest';
import { setTokenVerifier, verifyToken } from '../middleware/auth.js';
import type { AuthenticatedUser } from '../middleware/auth.js';

describe('Auth middleware — verifyToken & setTokenVerifier', () => {
  afterEach(() => {
    setTokenVerifier(null);
  });

  it('verifyToken returns null for an obviously invalid token', async () => {
    setTokenVerifier(() => Promise.resolve(null));
    const result = await verifyToken('not-a-real-token');
    expect(result).toBeNull();
  });

  it('verifyToken returns the user object from a valid injected verifier', async () => {
    const mockUser: AuthenticatedUser = { uid: 'user-123', email: 'test@example.com' };
    setTokenVerifier((token) => Promise.resolve(token === 'good-token' ? mockUser : null));

    const result = await verifyToken('good-token');
    expect(result).toEqual(mockUser);
  });

  it('verifyToken returns null when injected verifier rejects with an error', async () => {
    setTokenVerifier(() => Promise.reject(new Error('Firebase unavailable')));
    const result = await verifyToken('any-token');
    expect(result).toBeNull();
  });

  it('setTokenVerifier(null) resets to the default verifier without throwing', () => {
    setTokenVerifier(() => Promise.resolve({ uid: 'custom' }));
    expect(() => {
      setTokenVerifier(null);
    }).not.toThrow();
  });

  it('verifyToken with empty string token returns null', async () => {
    setTokenVerifier((token) => Promise.resolve(token.length > 0 ? { uid: 'u' } : null));
    const result = await verifyToken('');
    expect(result).toBeNull();
  });

  it('verifyToken strips uid correctly from injected token pattern', async () => {
    setTokenVerifier((token) =>
      Promise.resolve().then(() => {
        if (token.startsWith('test-token-')) {
          const uid = token.replace('test-token-', '').trim();
          if (uid.length > 0) return { uid, email: `${uid}@test.local` };
        }
        return null;
      }),
    );

    const result = await verifyToken('test-token-alice');
    expect(result).toEqual({ uid: 'alice', email: 'alice@test.local' });
  });

  it('verifyToken returns null for test-token with empty uid segment', async () => {
    setTokenVerifier((token) =>
      Promise.resolve().then(() => {
        if (token.startsWith('test-token-')) {
          const uid = token.replace('test-token-', '').trim();
          if (uid.length > 0) return { uid, email: `${uid}@test.local` };
        }
        return null;
      }),
    );

    const result = await verifyToken('test-token-');
    expect(result).toBeNull();
  });
});
