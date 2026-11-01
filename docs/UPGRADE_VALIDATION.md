# Utsav upgrade validation

The six-phase upgrade is implemented in the working tree. Existing commits were preserved.

## Implemented behavior

- Security: server-only voice credentials and bounded WebSocket relay, same-origin checks,
  strict CSP without inline React styles, request caps, prompt boundaries, and server/client
  schema validation. Malformed model output returns `AI_RESPONSE_INVALID`.
- Connected planning: exact rupee redistribution, locked/prioritized categories, catering
  scaling, quotation extraction/comparison/acceptance, verified budget commitments,
  dependency-aware schedules and delays, calendar folding, insights, bilingual fallback
  answers, intake parsing, guest recovery, and authenticated synchronization.
- AI execution: centralized model chain with cooldowns, cancellation and timeouts;
  validated NDJSON results with public progress summaries; client request replacement and
  unmount cancellation. Private model reasoning is never exposed.
- Maintainability: production modules are limited to 250 lines except static presets;
  all tests are included in TypeScript checking; strict type-aware ESLint and JSX
  accessibility rules are enabled. Hygiene checks reject unsafe type escapes, executable
  markup, browser secrets, and inline React styles.
- Accessibility: keyboard tabs, modal focus traps and restoration, linked wizard error
  summaries, dashboard heading focus, persistent light/dark themes, contrast preferences,
  print summary, and real browser WCAG AA audits.
- Enforcement: full-stack coverage gates, 100% shared-engine coverage, real desktop/mobile
  journeys, and production dependency auditing are required in CI.

## Verification

Run from the repository root with Node 24:

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
CI=true npm run test:coverage
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

For the cloud image's installed Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The browser test runner builds client/server artifacts and starts an isolated server on
port 3101 using documented fallback sentinels and explicitly enabled in-memory storage.
Production deployments still require Firestore. Browser checks exercise actual Helmet
headers, all dashboard tabs in light/dark desktop/mobile viewports, zero console/CSP
errors, overflow, quotations, sharing in a fresh browser, and intake/wizard workflows.

Verified results on 2026-11-01:

| Check | Result |
| --- | --- |
| TypeScript, strict lint, formatting | Passed |
| Unit and integration tests | 460 passed, no skipped tests |
| Global statements / lines | 96.30% / 97.31% |
| Global functions / branches | 95.17% / 90.29% |
| Shared engine statements, lines, functions, branches | 100% |
| Desktop/mobile browser journeys and WCAG audits | 14 passed |
| Production audit at high severity | Passed; no high or critical findings |

A representative multi-ceremony wedding benchmark ran redistribution, catering scaling,
accounting, scheduling, insights, and tradeoffs together for 1,000 iterations: median
0.038 ms and p95 0.085 ms on this cloud machine. These figures describe pure calculations,
not browser rendering, network latency, or a guarantee for arbitrary plan sizes.

Live Gemini, Google sign-in, Firestore, Places, and microphone/upstream voice calls need
real project configuration and were tested with controlled transports/mocks or fallback
mode here. No external deployment was performed as part of validation.
