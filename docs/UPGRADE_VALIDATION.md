# Utsav upgrade validation

The six-phase upgrade and the follow-up audit fixes are implemented. Existing commits and
the modern README were preserved.

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

## Follow-up audit fixes

- Tradeoffs keep the user's target budget, report the resulting actual spend, and disable
  options with an uncovered shortfall. Discretionary cuts stop at 40% and protect essentials,
  locked categories, and accepted quotations.
- Guest edits scale existing catering estimates, including manually entered costs. Accepted
  fixed-price and minimum-plate quotations retain their terms. Manual overrides clear stale
  acceptance and verification, while saved quotations remain available to restore.
- Newly generated short-notice plans persist compressed dates and preparation metadata.
  Timeline, assistant facts, shared views, print summaries, and calendar exports use the
  same effective deadlines. Legacy plans retain their saved dates and overdue state.
  Tasks can share a deadline when the available runway is too short for distinct dates.
- Delay explanations account for available slack and the prerequisites that determine a
  task's date. Finished tasks cannot be delayed, and delays are bounded to 365 days.
- Identical concurrent generation requests share an upstream call, with separate progress,
  cancellation, and result copies for each caller. Cancelling every caller stops the flight;
  failures and abandoned requests cannot poison subsequent requests or the cache.
- Saved guest, account, and shared plans remain readable after their event date. Calendar
  validity, structural validation, authorization, and share expiry still apply; creation
  continues to reject past dates.
- Reviews enforce one to six entries per list and can be dismissed and requested again.
  All server routes have an AST regression check for Gemini/Maps credentials in JSON and
  text responses. Populated voice transcripts pass browser contrast/accessibility checks
  using real WebAudio with a simulated microphone and controlled WebSocket messages.

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
errors, overflow, quotations, sharing in a fresh browser, intake/wizard workflows, and
populated voice conversations using a simulated microphone and controlled WebSocket relay.

Verified results on 2026-11-01:

| Check                                                | Result                               |
| ---------------------------------------------------- | ------------------------------------ |
| TypeScript, strict lint, formatting                  | Passed                               |
| Unit and integration tests                           | 543 passed, no skipped tests         |
| Global statements / lines                            | 96.78% / 97.67%                      |
| Global functions / branches                          | 95.96% / 91.27%                      |
| Shared engine statements, lines, functions, branches | 100%                                 |
| Desktop/mobile browser journeys and WCAG audits      | 18 passed                            |
| Production audit at high severity                    | Passed; no high or critical findings |

A representative multi-ceremony wedding benchmark ran redistribution, catering scaling,
accounting, scheduling, insights, and tradeoffs together for 1,000 iterations: median
0.064 ms and p95 0.137 ms on this cloud machine. These figures describe pure calculations,
not browser rendering, network latency, or a guarantee for arbitrary plan sizes.

The production dependency audit still reports eight moderate findings in transitive
Firebase Admin dependencies. Resolving the full chain requires a separate major dependency
upgrade; the high-severity CI gate passes without changing dependency versions here.

Live Gemini, Google sign-in, Firestore, Places, and microphone/upstream voice calls need
real project configuration and were tested with controlled transports/mocks or fallback
mode here. No external deployment was performed as part of validation.
