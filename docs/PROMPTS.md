# Utsav Prompt Log & System Instructions

This document tracks key prompts, model system instructions, and design iterations for Utsav's Gemini-powered event planner.

## Initial Challenge Brief
> Build "Utsav" — an India-first GenAI celebration & event planner for the Hack2Skill × VirtualPromptWars Challenge 5: "Celebration & Event Planner".
> Features: (1) budget planner, (2) timeline, (3) vendor checklist, (4) personalized ideas.

## Architectural Refinements
- Single package structure (`src/client`, `src/server`, `src/shared`).
- Zod schemas in `src/shared/schemas.ts` serve as the single source of truth for TypeScript types (`z.infer`) and Gemini's JSON schema (native `z.toJSONSchema`).
- Flat schema for all events with optional `subEvent` tag (e.g., "Haldi", "Sangeet", "Visarjan").
- Pure TS deterministic math for budget allocations (largest-remainder method).
- Refine chat strictly scoped to rewrites of ideas/text, with 300-char input limit.

## Gemini Prompt Templates
1. **Plan Generation (`buildPlanPrompt`)**:
   - Instructs model as expert Indian celebration planner.
   - Outputs percentage allocations, days-before timeline milestones, vendor interview questions with booking lead-times, and 5+ creative ideas.
   - Enforces cultural nuances (sub-events, dietary constraints, community permits).
2. **Section Refinement (`buildRefinePrompt`)**:
   - Strictly rewrites ideas for a chosen section according to user modification instructions (e.g. "make it eco-friendly").

## Fix, Hardening & Pre-Deploy Verification Prompt
- Elimination of third-party `zod-to-json-schema` in favor of native Zod v4 `z.toJSONSchema` with schema properties & required keys assertions.
- Addition of `meta.source: "gemini" | "cache" | "fallback"` to `/api/plan` and `/api/refine` with console logging.
- Helmet Cross-Origin-Opener-Policy set to `same-origin-allow-popups` and `https://lh3.googleusercontent.com` added to `img-src` for Firebase Google authentication.
- Production Cloud Run runtime configuration via `--env-vars-file env.yaml` (`env.example.yaml` committed, `env.yaml` gitignored).
- Rate limiter (`generationLimiter`) isolated to AI generation routes and running before body validation.
- Per-route body limits (`100kb` for plan/refine, `200kb` for share).
- Expiration check on `GET /api/share/:token` returning 404 when expired.
- Asia/Kolkata timezone boundary test running at 00:30 IST (19:00 UTC previous day).
- Statutory permit advisory in Vendors and approximate cost advisory in Ideas.
- Lazy dynamic import of Firebase SDK ensuring guests never download it on initial page load.

## Final Pre-Deploy Hardening Prompt
1. Model: Switched `GEMINI_MODEL` to "gemini-3.5-flash" (code default + env.example.yaml). Documented latency-based thinking level tuning.
2. Share TTL: Stored `expiresAt` as Firestore Timestamp (Date via Admin SDK) so Firestore TTL works, and verified expiry with `expiresAt.toMillis() < Date.now()`.
3. Firebase configuration: Added `firebase.json` (pointing to `firestore.rules`) and `.firebaserc` (with placeholder project ID) for seamless `firebase deploy --only firestore:rules`.
4. Startup env validation: Built fail-fast Zod schema validation in `src/server/env.ts` checking all `GEMINI_*` and `FIREBASE_*` variables at server startup.
5. Least-privilege IAM: Updated deployment docs to use dedicated runtime service account `utsav-run` with only `roles/datastore.user` and `roles/secretmanager.secretAccessor`.
