import { z } from 'zod';
import fs from 'fs';

// Automatically load .env file in non-production environments if present
if (
  process.env.NODE_ENV !== 'production' &&
  fs.existsSync('.env') &&
  typeof process.loadEnvFile === 'function'
) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Silently continue if .env cannot be loaded
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  GEMINI_API_KEY: z
    .string({
      required_error: 'GEMINI_API_KEY is required',
    })
    .min(1, 'GEMINI_API_KEY is required and cannot be empty'),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  FIREBASE_API_KEY: z
    .string({
      required_error: 'FIREBASE_API_KEY is required',
    })
    .min(1, 'FIREBASE_API_KEY is required'),
  FIREBASE_AUTH_DOMAIN: z
    .string({
      required_error: 'FIREBASE_AUTH_DOMAIN is required',
    })
    .min(1, 'FIREBASE_AUTH_DOMAIN is required'),
  FIREBASE_PROJECT_ID: z
    .string({
      required_error: 'FIREBASE_PROJECT_ID is required',
    })
    .min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_STORAGE_BUCKET: z
    .string({
      required_error: 'FIREBASE_STORAGE_BUCKET is required',
    })
    .min(1, 'FIREBASE_STORAGE_BUCKET is required'),
  FIREBASE_MESSAGING_SENDER_ID: z
    .string({
      required_error: 'FIREBASE_MESSAGING_SENDER_ID is required',
    })
    .min(1, 'FIREBASE_MESSAGING_SENDER_ID is required'),
  FIREBASE_APP_ID: z
    .string({
      required_error: 'FIREBASE_APP_ID is required',
    })
    .min(1, 'FIREBASE_APP_ID is required'),
  // Optional — enables real vendor search via Google Places API (New)
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at server startup.
 * Fails fast with a formatted message listing all missing variables.
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const missingVars = result.error.issues.map((issue) => {
      const field = issue.path.join('.');
      return `  - ${field}: ${issue.message}`;
    });
    const errorMessage = `❌ Server startup failed: Missing or invalid required environment variables:\n${missingVars.join(
      '\n',
    )}\n\nPlease ensure required variables are set in your env.yaml, Secret Manager, or .env file before starting the server.`;
    throw new Error(errorMessage);
  }
  return result.data;
}
