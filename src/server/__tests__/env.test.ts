import { describe, it, expect } from 'vitest';
import { validateEnv } from '../env.js';

describe('Server Startup Environment Validation (Zod fail-fast)', () => {
  const validEnv = {
    NODE_ENV: 'production',
    PORT: '8080',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-3.5-flash',
    FIREBASE_API_KEY: 'test-firebase-key',
    FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: '123456789012',
    FIREBASE_APP_ID: '1:123456789012:web:abcdef123456789',
  };

  it('validates a complete environment configuration and parses types', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.PORT).toBe(8080);
    expect(parsed.GEMINI_MODEL).toBe('gemini-3.5-flash');
    expect(parsed.FIREBASE_PROJECT_ID).toBe('test-project');
  });

  it('defaults GEMINI_MODEL to gemini-3.5-flash if omitted', () => {
    const { GEMINI_MODEL: _model, ...envWithoutModel } = validEnv;
    const parsed = validateEnv(envWithoutModel);
    expect(parsed.GEMINI_MODEL).toBe('gemini-3.5-flash');
  });

  it('fails fast with a clear message listing all missing variables', () => {
    expect(() => validateEnv({})).toThrowError(/Server startup failed/);

    try {
      validateEnv({});
      expect.fail('Should have thrown an error');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('GEMINI_API_KEY');
      expect(msg).toContain('FIREBASE_API_KEY');
      expect(msg).toContain('FIREBASE_AUTH_DOMAIN');
      expect(msg).toContain('FIREBASE_PROJECT_ID');
      expect(msg).toContain('FIREBASE_STORAGE_BUCKET');
      expect(msg).toContain('FIREBASE_MESSAGING_SENDER_ID');
      expect(msg).toContain('FIREBASE_APP_ID');
    }
  });

  it('fails if GEMINI_API_KEY or FIREBASE_API_KEY is empty string', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        GEMINI_API_KEY: '',
      }),
    ).toThrowError(/GEMINI_API_KEY/);
  });
});
