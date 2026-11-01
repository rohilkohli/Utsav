# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, e-mail the maintainer directly (see the repository's profile) with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce
3. Any proof-of-concept code

You will receive a response within **48 hours** acknowledging the report. We will work with you to understand and resolve the issue before any public disclosure.

## Security Measures in This Project

- **Content Security Policy** — strict script, style, connection, and framing directives with specific allowed services.
- **Rate limiting** — generation, sharing, vendor-search, and voice entry points have rate limits.
- **Authentication** — Firebase Auth (Google Sign-In) for user identity; server validates every Firebase ID token before accessing user data.
- **API keys** — Gemini and Places credentials stay server-side. Use Secret Manager for production secrets; Firebase web configuration is intentionally public.
- **Input validation** — Zod schemas and payload caps guard API inputs and structured model output; prompt boundaries treat user text as untrusted. Firestore access uses the Admin SDK.
- **CORS** — not enabled; server only serves its own SPA and API.
- **Dependency hygiene** — `npm audit` is run in CI on every push.
