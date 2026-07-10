# SentinelAI — Low Level Design (LLD)

Version: 2.0 — 2026-07-10 (updated to reflect the AS-BUILT system)
Companion to `HLD.md`. This document is implementation-level: schemas, endpoints, folder
structure, and sequence flows, matching the actual codebase.

---

## 1. Folder Structure (as built)

```
server/
  server.js
  src/
    app.js
    config/
      db.js
    middleware/
      authMiddleware.js         // JWT verification, sets req.user
      scanRateLimiter.js         // rate-limits POST /projects/:id/scans only
    models/
      User.js
      Project.js
      Scan.js                    // findings embed owasp + remediation per item
      AiExplanationCache.js       // checkId -> cached AI impact text (~10 rows max)
    controllers/
      authController.js
      projectController.js
      scanController.js
      dashboardController.js
    routes/
      authRoutes.js
      projectRoutes.js
      scanRoutes.js
      dashboardRoutes.js
    scanner/                       // pure logic, no Express/DB imports
      runScan.js
      checks/
        httpHeaders.js
        https.js
        cookies.js
        cors.js
      owaspMap.js
      remediationMap.js
      scoring.js
    ai/
      AIProvider.js
      providers/
        gemini.js
        fallback.js
      index.js                     // cache orchestration + report assembly
      promptSanitizer.js
      outputSanitizer.js
    utils/
      generateToken.js
      ssrfGuard.js

client/
  src/
    context/
      AuthContext.jsx              // plain React Context, not Redux
    routes/
      AppRouter.jsx
      ProtectedRoute.jsx
    services/
      api.js                        // axios instance + JWT interceptor
      auth.api.js
      projects.api.js
      scans.api.js
      dashboard.api.js
    pages/
      Login/Login.jsx
      Register/Register.jsx
      Dashboard/Dashboard.jsx        // Projects list + account-wide stats
      Scan/Scan.jsx                   // trigger scan, render findings + AI impact
      History/History.jsx
      Home, Profile, Report, Settings  // still unrouted 7-line stubs (not built)
```

---

## 2. Database Schema (as built)

### 2.1 `User`
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

### 2.2 `Project`
```js
{
  owner: ObjectId -> User,   // indexed, every query filters by this
  name: String,
  url: String,
  timestamps: true
}
```

### 2.3 `Scan`
```js
{
  project: ObjectId -> Project,   // indexed
  status: "completed" | "failed",  // no "pending"/"running" — scans run synchronously
  findings: [
    {
      checkId: String,
      title: String,
      description: String,
      severity: "critical" | "high" | "medium" | "low" | "info",
      owasp: String,               // from scanner/owaspMap.js
      evidence: String,             // raw header/cookie value from the scanned site
      remediation: String,           // from scanner/remediationMap.js — never AI-generated
    }
  ],
  score: Number,                    // 0-100
  severityCounts: { critical, high, medium, low, info },
  aiExplanation: String,             // markdown: title/OWASP (ours) + impact (AI) + fix (ours)
  error: String,                      // populated only when status === "failed"
  timestamps: true
}
```

### 2.4 `AiExplanationCache`
```js
{
  checkId: String,   // unique — one row per issue TYPE, capped at ~10 rows total
  explanation: String, // the AI's (or fallback's) impact-analysis text for this checkId
  timestamps: true
}
```

---

## 3. API Design (as built)

All routes under `/api`, JWT bearer auth via `authMiddleware.protect` unless noted.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | register a new user |
| POST | `/auth/login` | public | login, returns JWT |
| GET | `/auth/profile` | yes | current user |
| GET | `/projects` | yes | list current user's projects |
| POST | `/projects` | yes | create project `{name, url}` |
| GET | `/projects/:id` | yes | get one project + its latest scan |
| DELETE | `/projects/:id` | yes | delete project (cascades its scans) |
| POST | `/projects/:projectId/scans` | yes, rate-limited | run a scan **synchronously**, returns the completed `Scan` |
| GET | `/projects/:projectId/scans` | yes | list scans for a project (History page) |
| GET | `/scans/:id` | yes | fetch one scan by id (ownership checked via its parent project) |
| GET | `/dashboard/summary` | yes | aggregate: total projects, total scans, avg score, severity counts |

Not built: `/scans/:id/report.pdf` (PDF export), any polling-style "pending" scan status.

---

## 4. Sequence: Trigger a Scan (as built — synchronous)

```
Client                 Server (scanController)          Scanner            AI (ai/index.js)     MongoDB
  |  POST /projects/:id/scans                                                                        |
  |--------------------->|  confirm project.owner === req.user._id -------------------------------->  |
  |                      |  runScan(project.url) -------->|                                          |
  |                      |                                | SSRF guard (DNS resolve + reject)        |
  |                      |                                | one fetch -> 4 checks in parallel        |
  |                      |<------- findings[] -------------|                                          |
  |                      |  scoreFindings(findings)                                                   |
  |                      |    -> attach owasp + remediation, compute score                            |
  |                      |  generateExplanation(findings, summary) ----------------------->|          |
  |                      |                                   for each unique checkId:                |
  |                      |                                     cache lookup ------------------------->|
  |                      |                                     [HIT] reuse | [MISS] call Gemini,      |
  |                      |                                       fallback on failure, sanitize, cache-->|
  |                      |<---------------------------------- aiExplanation (markdown) ---|            |
  |                      |  Scan.create({ status: "completed", ... }) ------------------------------->  |
  |<-- full Scan JSON ----|                                                                             |
```

No polling — the client's `triggerScan()` call simply resolves once this whole chain completes
(typically 0.5-2s on a cache hit, longer on a cache miss with a live Gemini call).

---

## 5. Scanner Check Contract (as built)

```js
// Every file in scanner/checks/ exports this shape:
export default async function check(url, context) {
  // context = { headers, setCookieHeaders, finalUrl, status } — built ONCE in
  // runScan.js from a single fetch, shared across all checks.
  return [ { checkId, title, description, severity, evidence } ]; // or []
}
```
`runScan.js` fetches the URL once, builds `context`, runs all 4 checks via `Promise.allSettled`
(one failing check doesn't kill the scan), flattens the results, then hands them to
`scoreFindings()`.

Implemented checks:
- `httpHeaders.js` — missing `Content-Security-Policy` / `X-Frame-Options` /
  `X-Content-Type-Options` / `Strict-Transport-Security`
- `https.js` — target URL isn't `https://`
- `cookies.js` — any `Set-Cookie` missing `Secure` / `HttpOnly` / `SameSite`
- `cors.js` — `Access-Control-Allow-Origin: *` (flagged higher if combined with
  `Access-Control-Allow-Credentials: true`)

Not implemented (from the original spec): tech detection, robots.txt/sitemap analysis, directory
listing detection, JS secret scanning, TLS certificate inspection.

---

## 6. AI Engine Detail (as built — impact analysis + remediation split)

```js
// ai/AIProvider.js — the interface every provider implements
export default class AIProvider {
  async explainCheck(check) { throw new Error("not implemented"); }
  // check = { checkId, title, description, severity, owasp } — ONE issue type,
  // never a whole scan's findings, and never per-scan evidence (see below).
}
```

```js
// ai/index.js — orchestration (simplified)
async function explainOneCheck(check) {
  const cached = await AiExplanationCache.findOne({ checkId: check.checkId });
  if (cached) return cached.explanation;             // cache HIT: zero AI calls

  let text;
  try { text = await geminiProvider.explainCheck(check); }
  catch { text = await fallbackProvider.explainCheck(check); }

  const safe = sanitizeAiOutput(text);
  await AiExplanationCache.create({ checkId: check.checkId, explanation: safe });
  return safe;
}
```

**What the AI prompt asks for** (`providers/gemini.js`): 1-2 sentences describing a *realistic
attack scenario* for this specific issue — explicitly instructed NOT to repeat the technical
description (already shown in the findings list) and NOT to suggest a fix (handled
deterministically, see below). `title`/`description` pass through `promptSanitizer.js` first
(defense-in-depth); `evidence` is never included at all, both because it's the one genuinely
attacker-influenced field and because including it would break the checkId-based cache (evidence
differs per scan; the cache assumes one reusable explanation per checkId).

**What never touches the AI** (`scanner/remediationMap.js`, applied in `scoring.js` before the AI
is even called): the exact fix for each checkId — e.g. *"Add the `HttpOnly` attribute to this
cookie so client-side JavaScript cannot read its value."* Hand-written, reviewed, always
identical for a given checkId, and always present even if Gemini and the fallback both somehow
failed (they can't — the fallback never throws — but remediation doesn't even depend on that
guarantee).

**Final report assembly** (`buildReport()` in `ai/index.js`, no AI involved): for each finding,
prints `title` + `owasp` (from the checks themselves), `*Impact:*` (the AI text from above), and
`*Recommended fix:*` (`finding.remediation`, deterministic) — three distinct sources, laid out so
nothing is ever repeated twice.

---

## 7. Security Details (as built)

- **SSRF guard** (`utils/ssrfGuard.js`): DNS-resolves the scan target's hostname and rejects it if
  any resolved IP falls in a private/loopback/link-local range (10.x, 172.16–31.x, 192.168.x,
  127.x, 169.254.x, `::1`, `fc00::/7`). Resolves DNS rather than checking the hostname string
  alone, specifically to defend against DNS rebinding (a domain that resolves to a private IP).
- **Rate limiting**: `middleware/scanRateLimiter.js` on scan creation only (10 requests / 10 min
  per IP) — not yet applied to login/register (see HLD §6).
- **Ownership checks**: every project/scan lookup filters by `req.user._id`, and a scan is looked
  up via its parent project's `owner` field — never a bare `Scan.findById` with no ownership check.
- **AI guardrails** (`ai/promptSanitizer.js`, `ai/outputSanitizer.js`): OWASP Top 10 for LLMs
  LLM01 (indirect prompt injection) and LLM02 (insecure output handling) — see HLD §2.5 for the
  reasoning. Verified directly against adversarial input (an injection-phrase-laden string, and
  an HTML/script-tag-laden string) during development.

---

## 8. Not Yet Built

- PDF report export (`pdfkit`/`puppeteer`, `/scans/:id/report.pdf`)
- Profile / Settings pages
- Async scan queue + polling (`status: "pending"/"running"`) — scans are synchronous today
- Docker (`server/Dockerfile`, `client/Dockerfile`) + Jenkins pipeline
- Remaining 5 scanner checks (tech detection, robots.txt/sitemap, directory listing, JS secret
  scanning, TLS certificate inspection)
- "Chat with AI about a scan" (multi-turn, scoped to one scan's findings)
- Login/register rate limiting
