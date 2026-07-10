# SentinelAI — Low Level Design (LLD)

Version: 1.0 — 2026-07-10
Companion to `HLD.md`. This document is implementation-level: schemas, endpoints, folder
structure, sequence flows, and DevOps config.

---

## 1. Folder Structure (target state)

```
server/
  src/
    app.js
    server.js
    config/
      db.js
      env.js                 // centralizes process.env reads + validation
    middleware/
      authMiddleware.js       // existing
      errorHandler.js         // new — central error -> JSON response
      rateLimiter.js           // new — protects /scans
    models/
      User.js                 // existing
      Project.js               // new
      Scan.js                   // new
    controllers/
      authController.js        // existing
      projectController.js     // new
      scanController.js         // new
      reportController.js       // new
    routes/
      authRoutes.js             // existing
      projectRoutes.js          // new
      scanRoutes.js              // new
      reportRoutes.js            // new
    scanner/                    // pure logic, no Express/DB imports
      runScan.js
      checks/
        httpHeaders.js
        https.js
        cookies.js
        cors.js
        techDetection.js
        robotsSitemap.js
        directoryListing.js
        jsSecretScan.js
        certificate.js
      owaspMap.js               // finding-type -> OWASP category + weight
      scoring.js                 // findings -> score
    ai/
      AIProvider.js              // interface
      providers/
        ollama.js
        openai.js
      index.js                    // picks provider from env var
    utils/
      generateToken.js            // existing
      ssrfGuard.js                  // new — blocks scans of private/internal IPs

client/
  src/
    app/
      store.js                     // Redux Toolkit store (auth, activeProject only)
      slices/
        authSlice.js
        activeProjectSlice.js
    routes/
      AppRouter.jsx                 // React Router config
      ProtectedRoute.jsx
    services/
      api.js                        // existing, add interceptor
      auth.api.js
      projects.api.js
      scans.api.js
    pages/
      Home, Login, Register, Dashboard, Projects, Scan, Report, History, Profile, Settings
    components/
      layout/ (Navbar, Sidebar)
      ui/ (Button, Card, Badge, ScoreGauge) — plain Tailwind, no shadcn
```

---

## 2. Database Schema

### 2.1 `User` (existing — no changes needed)
```js
{
  name: String,
  email: String, // unique
  password: String, // bcrypt hash
  role: "user" | "admin",
  isVerified: Boolean,
  timestamps: true
}
```

### 2.2 `Project` (new)
```js
{
  owner: ObjectId -> User,
  name: String,               // "My Portfolio"
  url: String,                 // "https://ayush.dev" — validated http/https, normalized
  createdAt / updatedAt
}
```
Index: `{ owner: 1 }` for "list my projects".

### 2.3 `Scan` (new)
```js
{
  project: ObjectId -> Project,
  status: "pending" | "running" | "completed" | "failed",
  startedAt: Date,
  completedAt: Date,
  findings: [
    {
      checkId: String,        // e.g. "missing-csp-header"
      title: String,
      description: String,
      severity: "critical"|"high"|"medium"|"low"|"info",
      owasp: String,           // e.g. "A05:2021 - Security Misconfiguration"
      evidence: String,         // raw header/value that triggered it
    }
  ],
  score: Number,               // 0-100
  severityCounts: { critical: Number, high: Number, medium: Number, low: Number },
  aiExplanation: String,        // markdown, generated once
  error: String,                 // populated if status === "failed"
  timestamps: true
}
```
Index: `{ project: 1, createdAt: -1 }` for history/trend queries.

---

## 3. API Design

All routes under `/api`, JWT bearer auth via existing `protect` middleware unless noted.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | existing |
| POST | `/auth/login` | public | existing |
| GET | `/auth/profile` | yes | existing |
| GET | `/projects` | yes | list current user's projects |
| POST | `/projects` | yes | create project `{name, url}` |
| GET | `/projects/:id` | yes | get one project + its latest scan summary |
| DELETE | `/projects/:id` | yes | delete project (and cascade its scans) |
| POST | `/projects/:id/scans` | yes | trigger a new scan → returns `{scanId, status:"pending"}` |
| GET | `/projects/:id/scans` | yes | list scans for a project (history) |
| GET | `/scans/:id` | yes | poll scan status/result |
| GET | `/scans/:id/report.pdf` | yes | generate & stream PDF |
| GET | `/dashboard/summary` | yes | aggregate: totals, avg score, severity counts across all projects |

Rate limit: `POST /projects/:id/scans` → max 5 requests / 10 min / user (prevents using SentinelAI
as a scanning proxy against arbitrary targets).

---

## 4. Sequence: Trigger + Complete a Scan

```
Client            Server(API)         Scanner(async job)        AI Engine        MongoDB
  |  POST /scans      |                                                            |
  |------------------->|  create Scan{pending} -------------------------------------->|
  |<--- scanId ---------|
  |                    |  fire-and-forget runScan(url)                              |
  |                    |------------------------->|                                 |
  |                    |                          | run 9 checks in parallel        |
  |                    |                          | (Promise.allSettled)            |
  |                    |<-------- findings[] ------|                                 |
  |                    |  score(findings) -> score, owaspBuckets                     |
  |                    |------------------------------------------------->|          |
  |                    |                                    explain(findings,score) |
  |                    |<---------------------------------- aiExplanation-|          |
  |                    |  Scan.status = completed -----------------------------------> |
  |  GET /scans/:id     |                                                            |
  |------------------->|  read Scan --------------------------------------------------> |
  |<---- result --------|
```

Client polling strategy: poll every 3s while `status ∈ {pending, running}`, stop on
`completed`/`failed`, max 60s timeout with a "still scanning, check back later" fallback.

---

## 5. Scanner Check Contract

Every file in `scanner/checks/` exports:
```js
export default async function check(url, context) {
  // context = { headers, html, cookies } — fetched once in runScan.js and shared
  // to avoid every check re-fetching the same page
  return [ { checkId, title, description, severity, evidence } ]; // or []
}
```
`runScan.js` fetches the URL once (headers + body), builds `context`, then runs all checks
against that shared context — not 9 separate HTTP requests to the target site.

Checks to implement (mapped to spec's scanner list):
- `httpHeaders.js` — missing CSP / X-Frame-Options / X-Content-Type-Options / HSTS
- `https.js` — non-HTTPS URL, mixed content in HTML
- `cookies.js` — missing `Secure`/`HttpOnly`/`SameSite` flags
- `cors.js` — `Access-Control-Allow-Origin: *` combined with credentials
- `techDetection.js` — server/framework fingerprinting via headers + meta tags (informational, not a vuln by itself)
- `robotsSitemap.js` — presence + sensitive paths disclosed
- `directoryListing.js` — check common paths (`/uploads/`, `/.git/`, `/backup/`) for open listing
- `jsSecretScan.js` — regex scan of linked JS files for API-key-shaped strings
- `certificate.js` — TLS cert expiry/validity (Node `tls` module)

---

## 6. AI Engine Detail

```js
// ai/AIProvider.js
export default class AIProvider {
  async explain(findings, scoreSummary) { throw new Error("not implemented"); }
}
```
```js
// ai/index.js
import ollama from "./providers/ollama.js";
import openai from "./providers/openai.js";
const providers = { ollama, openai };
export default providers[process.env.AI_PROVIDER || "ollama"];
```
Prompt template (fixed, not user-editable): pass findings as structured JSON + score, ask for
markdown output with sections "Summary", "What this means", "How to fix it" per severity group.
One call per scan — findings are batched, never one AI call per individual finding.

---

## 7. Security Details

- **SSRF guard** (`utils/ssrfGuard.js`): before scanning, resolve the URL's hostname and reject if
  it resolves to a private/loopback/link-local range (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x,
  ::1). This is critical — without it, SentinelAI itself becomes an SSRF tool against internal
  infrastructure.
- **Rate limiting** on scan creation (see §3).
- **Ownership check**: every `/projects/:id` and `/scans/:id` route confirms `project.owner === req.user.id`
  before returning data — prevents scanning/reading other users' projects by guessing IDs.
- **No arbitrary redirect following past N hops** in the scanner's fetch step (avoid being bounced
  to an internal address after the SSRF check passes on the original URL).

---

## 8. PDF Report Generation

- Library: `pdfkit` or `puppeteer` (puppeteer is heavier — prefer `pdfkit` for a lightweight
  server-side render given no complex charts needed initially).
- `reportController.js` reads the completed `Scan`, renders a fixed template (score, severity
  breakdown, findings table, AI explanation section), streams `application/pdf`.

---

## 9. DevOps: Docker + Jenkins

### 9.1 Dockerfiles
```
server/Dockerfile        node:20-alpine, npm ci --omit=dev, CMD ["node","server.js"]
client/Dockerfile        multi-stage: node:20-alpine build -> nginx:alpine serve /dist
docker-compose.yml        server + client + (optional local mongo for dev only; prod uses Atlas)
```

### 9.2 Jenkins Pipeline (`Jenkinsfile`)
Stages:
1. **Checkout**
2. **Install** — `npm ci` in both `client/` and `server/`
3. **Lint** — `npm run lint` (client eslint config already exists)
4. **Test** — unit tests for `scanner/checks/*` (pure functions, easy to test with mocked fetch)
5. **Build** — `docker build` for both images, tag with git SHA
6. **Push** — push images to a registry (Docker Hub or GitHub Container Registry)
7. **Deploy trigger** — curl Railway's deploy webhook (frontend deploy is separate via Vercel git integration)

This mirrors the DevOps skills already listed on the developer's GitHub (Docker, Jenkins, CI/CD)
rather than introducing new unfamiliar tooling.

---

## 10. What to Build First (suggested order)

1. `Project` model + CRUD routes (small, unlocks everything else)
2. `Scan` model + `scanner/` module with 2–3 checks (httpHeaders, https, cookies) — get the
   pipeline working end-to-end before adding all 9 checks
3. Scoring + OWASP mapping (pure functions, easy to unit test)
4. Wire up React Router + Redux `auth` slice, connect Login/Register to real API
5. Scan trigger + polling UI, Report page rendering real data
6. AI Engine (single provider) — plug in last, once findings pipeline is proven deterministic
7. PDF export, Dashboard aggregation, remaining checks
8. Docker + Jenkins once the app has something worth deploying
