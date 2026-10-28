# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, e-mail the maintainer directly (see the repository's profile) with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce
3. Any proof-of-concept code

You will receive a response within **48 hours** acknowledging the report. We will work with you to understand and resolve the issue before any public disclosure.

## Security Measures in This Project

- **Content Security Policy** — strict `connectSrc` and `scriptSrc` directives, no external scripts loaded at runtime.
- **Rate limiting** — all API endpoints are rate-limited per IP to prevent abuse.
- **Authentication** — Firebase Auth (Google Sign-In) for user identity; server validates every Firebase ID token before accessing user data.
- **API keys** — never embedded in client bundles; GEMINI_API_KEY and GOOGLE_MAPS_API_KEY are stored in Google Cloud Secret Manager and injected at runtime.
- **No SQL / injection surface** — Firestore uses typed SDK calls, no raw query concatenation.
- **CORS** — not enabled; server only serves its own SPA and API.
- **Dependency hygiene** — `npm audit` is run in CI on every push.
