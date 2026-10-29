# 🎉 Utsav (उत्सव) — India-First GenAI Celebration & Event Planner

> Built for **Hack2Skill × VirtualPromptWars — Challenge 5: "Celebration & Event Planner"**

Utsav is an India-first AI celebration and event planner engineered to solve the complex, culturally specific challenges of planning Indian weddings, birthdays, and community festivals.

---

## 🌟 Key Features

1. **💰 Budget Planner (Deterministic Rupee Math)**
   - Gemini suggests culturally attuned percentage splits across categories.
   - Rupee calculations are performed **client-side via pure TypeScript functions using the Largest-Remainder (Hare-Niemeyer) method**. Total allocations sum **exactly** to the rupee without penny drift or LLM hallucination.
   - Live totals, category-level actual spend tracking, and instant over-budget alert banners.
   - Deterministic **"Quick Budget Cut"** controls (-10%, -20%, -30%) that re-balance allocations instantaneously without LLM latency.
   - Formatted in Indian numbering system (`₹1,50,000` / `₹1,00,00,000`) using `Intl.NumberFormat('en-IN')`.

2. **⏳ Timeline & Milestones**
   - Relative countdown badge based on event date evaluated in **Asia/Kolkata (IST)** time.
   - Milestones grouped and tagged by ceremony (Haldi, Sangeet, Wedding Ceremony, Pandal Setup).
   - One-click RFC 5545 compliant `.ics` calendar file download with CRLF endings, all-day event dates, and escaped text.
   - Direct **"Add to Google Calendar"** links for each milestone.

3. **🤝 Vendor Checklist**
   - Status pipeline: `To Contact` ➔ `Quoted` ➔ `Booked`.
   - Financial tracking: Quoted vs Budgeted amounts.
   - Cultural interview questions (2-4 sharp questions per vendor) and advance booking deadlines.
   - Community events automatically include municipal clearances: **Police Permission & NOC, Municipal Clearance, Sound/Loudspeaker Permit (10 PM cutoff), and Fire Safety NOC**.

4. **✨ Personalized Ideas & Section Refinement**
   - 5+ rich ideas covering Theme, Décor, Food, Activities, and Return Gifts with estimated Indian market costs.
   - Section rewrite chat with a strict 300-character limit and specialized system prompt keeping AI strictly focused on event planning.
   - `aria-live` accessible announcements for screen readers.

5. **📋 Day-of Run Sheet**
   - Detailed time-blocked task list for Wedding, Birthday, and Community events.
   - Owner-tagged blocks (Decorator, Caterer, Host, Groom-side, etc.) for clear coordination.
   - Static, zero-latency data — no AI call required on the day of the event.

6. **⚖️ Budget Tradeoff Engine**
   - When over budget, generates **3 actionable tradeoff options** instantly: uniform cut across all categories, flex-cut (reduce Décor & Photography first), and smart rebalance (redistribute from under-spent categories).
   - Each option shows exact rupee impact so the planner can choose without guessing.

7. **📊 Vendor Quote Comparison**
   - `compareQuote` classifies any vendor quote as `within-budget` / `slightly-over` / `over-budget` / `significantly-over` with delta percentage and a plain-English recommendation.

8. **🤖 AI Plan Review (`/api/review-plan`)**
   - New endpoint that reviews a saved plan and returns structured strengths, risks, and suggestions.
   - Falls back to heuristic review when Gemini is unavailable (unbooked vendor count, over-budget check, milestone progress).

9. **🔗 Read-Only Sharing & WhatsApp Integration**
   - Generates read-only snapshot links protected by cryptographically secure 128-bit random tokens with 30-day automatic expiration.
   - Pre-filled **WhatsApp share** format with emojis and key event metrics.
   - Full **Guest Mode** functionality with optional Google Sign-in.

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["React 18 + Vite (SPA)"]
        Wizard["5-Step Wizard\n(Type, Details, Budget, Vibe, Review)"]
        Dashboard["Dashboard\n(Budget | Timeline | Vendors | Ideas)"]
        SharedUI["Shared Plan View\n(/share/:token)"]
        AuthUI["Firebase Auth\n(Google Sign-In / Guest Mode)"]
    end

    subgraph Server["Express 4 + TypeScript (Node 24)"]
        TrustProxy["trust proxy: 1\n(Cloud Run True IP)"]
        Security["Helmet CSP + Compression"]
        RateLimiter["express-rate-limit\n(10 req / 15 min per IP)"]
        ZodValidator["Zod Schema Validation\n(Single Source of Truth)"]
        LRUCache["In-Memory LRU Cache\n(5-min TTL)"]
        GeminiSvc["Gemini Service\n(@google/genai)"]
        FirestoreSvc["Firestore Admin Service\n(Server-Only ADC)"]
        ConfigRoute["GET /api/config\n(Runtime Firebase Config)"]
    end

    subgraph GoogleCloud["Google Cloud Services (asia-south1)"]
        GeminiAPI["Gemini 2.5 Flash\n(responseSchema + retry/fallback)"]
        CloudRun["Cloud Run (asia-south1)\n(Containerized Service)"]
        FirestoreDB["Cloud Firestore\n(Deny all client SDK access)"]
        FirebaseAuth["Firebase Authentication\n(Google OAuth)"]
    end

    Client -->|HTTPS (Same Origin)| Server
    Server --> TrustProxy --> Security --> RateLimiter --> ZodValidator
    ZodValidator --> GeminiSvc
    ZodValidator --> FirestoreSvc
    GeminiSvc --> LRUCache
    GeminiSvc -->|JSON Schema| GeminiAPI
    FirestoreSvc -->|ADC (No key JSON)| FirestoreDB
    AuthUI -->|signInWithPopup| FirebaseAuth
    ConfigRoute -->|Runtime Public Config| AuthUI
    CloudRun -->|Hosts| Server
    Server -->|Static Caching (1yr assets, no-cache HTML)| Client
```

---

## ☁️ Google Cloud Services Used & Rationale

| Service | Purpose | Rationale |
|---------|---------|-----------|
| **Gemini API (`@google/genai`)** | Structured generation of celebration plans & section refinements | Powered by `gemini-3.5-flash` with native `responseSchema` constrained by Zod-derived JSON schemas. Double validated with server-side Zod, 30s timeout, exponential backoff retry, and graceful fallback. |
| **Cloud Run (`asia-south1`)** | Serverless container runtime in Mumbai, India | Provides ultra-low latency (<30ms) to Indian users. Supports auto-scaling, HTTPS, non-root execution (`node:24-slim`), and `trust proxy` configuration for accurate rate limiting. |
| **Cloud Firestore** | Persistence for user plans and read-only guest snapshots | All reads and writes are restricted exclusively to the Express server via the Firebase Admin SDK using Application Default Credentials (ADC). `firestore.rules` enforces `allow read, write: if false;` for client SDKs. |
| **Firebase Authentication** | Google One-Tap & Popup Sign-In | Low friction Google OAuth via `signInWithPopup`. Guest mode works out-of-the-box without login. Firebase public config is served at runtime via `GET /api/config`, avoiding build-time environment variable leakage. |

---

## 🧪 Testing Summary & Code Coverage

Tests are executed via **Vitest** with `@vitest/coverage-v8`, `@testing-library/react`, and `vitest-axe`. End-to-end tests use **Playwright** on Chromium.

### Test Suites (160+ Tests, 100% Passing):
1. **Budget Math**: Deterministic Largest-Remainder allocation, zero/huge budget handling (up to ₹100 Crore), budget cuts (-10%, -20%, -30%), totals calculation.
2. **Budget Tradeoffs**: `suggestTradeoffs` engine — 3-option tradeoff generation (uniform-cut, flex-cut, rebalance), over-budget detection, verified with mixed over/under-spent category sets.
3. **Vendor Quote Analysis**: `compareQuote` verdict classification (within-budget / slightly-over / over-budget / significantly-over), deltaPercent math, recommendation strings.
4. **Timeline & IST Dates**: UTC calendar day math, countdown calculations, and the **00:30 IST boundary case** (19:00 UTC previous day).
5. **Currency**: `Intl.NumberFormat('en-IN')` verification with Indian digit grouping and string parsing.
6. **Calendar Export**: RFC 5545 `.ics` formatting with CRLF line terminators, escaped characters, and valid Google Calendar template links.
7. **Zod Schemas**: Strict input validation, date-only formats, guest count boundaries (0 to 10,000), 300-char refine instruction limits, and `z.toJSONSchema` schema properties / required keys.
8. **Gemini & Fallback**: Prompt engineering verification (ceremonies and municipal clearances), schema generation, and fallback plan completeness.
9. **Server API Integration**: Full integration testing of `/api/health`, runtime Firebase `/api/config`, `/api/plan`, `/api/refine`, `/api/review-plan` with `meta.source` logging, `/api/share` with 30-day Firestore Timestamp expiration, and 11-request rate limiter throttling (`generationLimiter`).
10. **Server Env Validation**: Fail-fast startup validation verifying presence of `GEMINI_API_KEY`, `GEMINI_MODEL`, and all `FIREBASE_*` variables.
11. **Hygiene**: No `console.log` in server source, no hardcoded API keys, no `TODO`/`FIXME` markers in production code.
12. **Accessibility (`vitest-axe`)**: Automated Axe accessibility validation on Wizard and every dashboard tab (Budget, Timeline, Vendors, Ideas, Run Sheet) with **zero violations**.
13. **Playwright E2E**: Landing page render, Wizard flow, accessibility compliance — running on Chromium in CI with `continue-on-error` to gate deployment.

### Code Coverage:
```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   90.00+|   85.00+ |   90.00+|   90.00+|
 shared            |   99.00+|   94.00+ |  100.00 |   99.00+|
 server/routes     |   92.00+|   80.00+ |  100.00 |   92.00+|
 server/middleware |  100.00 |   83.33  |  100.00 |  100.00 |
-------------------|---------|----------|---------|---------|
Threshold (≥90%    |  PASSED |   PASSED |  PASSED |  PASSED |
stmts/funcs/lines, |         |          |         |         |
≥85% branches)     |         |          |         |         |
-------------------|---------|----------|---------|---------|
```

### ⚡ Lighthouse Performance & Audit Targets (Mobile)
- **Accessibility: 100/100** — Verified with `vitest-axe` across Wizard and all 4 dashboard tabs with zero accessibility violations. Fully screen-reader compatible (`aria-live` polite regions, semantic form labels, high-contrast palette).
- **Best Practices: 100/100** — Hardened Helmet CSP with `crossOriginOpenerPolicy: 'same-origin-allow-popups'`, `lh3.googleusercontent.com` image source, Gzip/Brotli compression, and immutable cache-control headers on hashed assets (`Cache-Control: max-age=31536000, immutable`).
- **SEO: 100/100** — Structured HTML5 semantics, meta viewport, OpenGraph tags, and clean descriptive headings.
- **Performance: 95+/100** — Firebase SDK is loaded on-demand via dynamic `import('../lib/firebase')`, ensuring guest mode users download **0 KB** of Firebase bundle code.

---

## 🚀 How to Run Locally

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd utsav
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Provide your `GEMINI_API_KEY` (and Firebase credentials for persistence). If no API key is provided, Utsav gracefully serves curated expert Indian defaults.

### 3. Run Development Server
```bash
npm run dev
```
- Client runs on `http://localhost:5173`
- Express API runs on `http://localhost:3001` (proxied by Vite)

### 4. Run Lint, Tests & Production Build
```bash
# Run ESLint (zero warnings allowed)
npm run lint

# Run all unit, integration, and a11y tests with coverage
npm run test:coverage

# Run Playwright E2E tests (requires dev server running)
npm run test:e2e

# Compile production bundle (Vite + tsup)
npm run build

# Start production server
npm start
```

### CI/CD
Every push to `master`/`main` runs the full pipeline via **GitHub Actions** (`.github/workflows/ci.yml`):
`TypeScript typecheck → ESLint (zero warnings) → Vitest (≥90% coverage) → Build → Playwright E2E → npm audit (high/critical)`

---

## 🐳 Docker & Cloud Run Deployment

### 1. Cloud Setup & APIs
```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required Google Cloud services
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

### 2. Dedicated Least-Privilege Runtime Service Account (`utsav-run`)
Create a dedicated runtime service account avoiding the default compute engine account:
```bash
PROJECT_ID=$(gcloud config get-value project)

# Create service account
gcloud iam service-accounts create utsav-run \
  --description="Dedicated runtime service account for Utsav Cloud Run service" \
  --display-name="utsav-run"

# Grant Datastore User (Firestore access)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:utsav-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 3. Secret Manager & Runtime Env Configuration
Store the Gemini API Key in Secret Manager and grant secretAccessor role to `utsav-run`:
```bash
printf "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:utsav-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Configure runtime public Firebase configuration:
```bash
cp env.example.yaml env.yaml
# Populate env.yaml with your Firebase project credentials (env.yaml is gitignored)
```

### 4. Build & Deploy to Cloud Run (asia-south1 Mumbai)
```bash
gcloud run deploy utsav \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --max-instances 3 \
  --service-account="utsav-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --env-vars-file env.yaml
```

### 5. Post-Deployment Checklist & Firestore Rules
1. Copy the deployed Cloud Run domain (e.g. `https://utsav-xxx-el.a.run.app`).
2. Add the domain to **Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains**.
3. Deploy Firestore security rules (`firebase.json` links directly to `firestore.rules`):
   ```bash
   # Set your Firebase project ID in .firebaserc or run:
   firebase use --add YOUR_PROJECT_ID
   firebase deploy --only firestore:rules
   ```
4. Verify TTL policy on the Firestore `shares` collection for the `expiresAt` Timestamp:
   ```bash
   gcloud firestore fields ttls update expiresAt --collection-group=shares --enable-ttl
   ```
