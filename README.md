# 🎉 Utsav (उत्सव) — India-First GenAI Celebration & Event Planner

> Built for the **Google PromptWars Virtual Challenge: "Celebration & Event Planner"**

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

5. **🔗 Read-Only Sharing & WhatsApp Integration**
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
| **Gemini API (`@google/genai`)** | Structured generation of celebration plans & section refinements | Powered by `gemini-2.5-flash` with native `responseSchema` constrained by Zod-derived JSON schemas. Double validated with server-side Zod, 30s timeout, exponential backoff retry, and graceful fallback. |
| **Cloud Run (`asia-south1`)** | Serverless container runtime in Mumbai, India | Provides ultra-low latency (<30ms) to Indian users. Supports auto-scaling, HTTPS, non-root execution (`node:24-slim`), and `trust proxy` configuration for accurate rate limiting. |
| **Cloud Firestore** | Persistence for user plans and read-only guest snapshots | All reads and writes are restricted exclusively to the Express server via the Firebase Admin SDK using Application Default Credentials (ADC). `firestore.rules` enforces `allow read, write: if false;` for client SDKs. |
| **Firebase Authentication** | Google One-Tap & Popup Sign-In | Low friction Google OAuth via `signInWithPopup`. Guest mode works out-of-the-box without login. Firebase public config is served at runtime via `GET /api/config`, avoiding build-time environment variable leakage. |

---

## 🧪 Testing Summary & Code Coverage

Tests are executed via **Vitest** with `@vitest/coverage-v8`, `@testing-library/react`, and `vitest-axe`.

### Test Suites (47 Tests Total, 100% Passing):
1. **Budget Math**: Deterministic Largest-Remainder allocation, zero/huge budget handling (up to ₹100 Crore), budget cuts (-10%, -20%, -30%), totals calculation.
2. **Timeline & IST Dates**: UTC calendar day math, countdown calculations, and the **00:30 IST boundary case** (19:00 UTC previous day).
3. **Currency**: `Intl.NumberFormat('en-IN')` verification with Indian digit grouping and string parsing.
4. **Calendar Export**: RFC 5545 `.ics` formatting with CRLF line terminators, escaped characters, and valid Google Calendar template links.
5. **Zod Schemas**: Strict input validation, date-only formats, guest count boundaries (0 to 10,000), and 300-char refine instruction limits.
6. **Gemini & Fallback**: Prompt engineering verification (ceremonies and municipal clearances), schema generation, and fallback plan completeness.
7. **Server API Integration**: Full integration testing of `/api/health`, `/api/config`, `/api/plan`, `/api/refine`, and `/api/share`.
8. **Accessibility (`vitest-axe`)**: Automated Axe accessibility validation on Wizard and every dashboard tab (Budget, Timeline, Vendors, Ideas) with **zero violations**.

### Code Coverage:
```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   83.67 |    81.50 |   87.80 |   83.67 |
-------------------|---------|----------|---------|---------|
Threshold (>80%)   |  PASSED |   PASSED |  PASSED |  PASSED |
-------------------|---------|----------|---------|---------|
```

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
Provide your `GEMINI_API_KEY` (and optionally Firebase credentials for persistence). If no API key is provided, Utsav gracefully serves curated expert Indian defaults.

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

# Compile production bundle (Vite + tsup)
npm run build

# Start production server
npm start
```

---

## 🐳 Docker & Cloud Run Deployment

### Build and Run Docker Container
```bash
docker build -t utsav:latest .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key utsav:latest
```

### Deploy to Cloud Run (asia-south1)
```bash
gcloud run deploy utsav \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --max-instances 3 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Post-Deployment Checklist:
1. Copy the deployed Cloud Run domain (e.g. `https://utsav-xxx.a.run.app`).
2. Add the domain to **Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains**.
