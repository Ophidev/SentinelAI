# SentinelAI — High Level Design (HLD)

Version: 2.0 — 2026-07-10 (updated to reflect the AS-BUILT system)
Companion to `LLD.md`. This document describes what is actually implemented today, not
the original aspirational spec — see §6 for what was deliberately deferred.

---

## 1. System Overview

SentinelAI is a full-stack app where a user submits a public website URL and gets back:
- a deterministic security scan (HTTP security headers, HTTPS usage, cookie flags, CORS config)
- an OWASP Top 10 (2021) mapping per finding
- a 0–100 security score
- a deterministic, hand-written remediation step per finding
- an AI-generated explanation of the realistic *impact* of each finding (not a restatement,
  not a fix — see §2.5)
- persisted history so scores can be tracked over time per project

The system is split into 5 logical layers behind one Express API:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React SPA)                       │
│   Login/Register · Dashboard (Projects + Stats) · Scan · History│
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST (axios, JWT bearer)
┌───────────────────────────▼──────────────────────────────────────┐
│                     Express API (server)                        │
│  ┌───────────┐ ┌────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │   Auth     │ │  Projects  │ │  Scanner Engine │ │ AI Engine  │ │
│  │  Module    │ │  Module    │ │  (deterministic)│ │ (impact)   │ │
│  └───────────┘ └────────────┘ └────────────────┘ └────────────┘ │
│                       │                │                 │      │
│                       ▼                ▼                 ▼      │
│                 ┌─────────────────────────────────────────┐     │
│                 │  Scoring + OWASP Mapping + Remediation   │     │
│                 └─────────────────────────────────────────┘     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                 ┌──────────▼──────────┐
                 │   MongoDB Atlas      │
                 │ Users/Projects/Scans │
                 │ AiExplanationCache   │
                 └──────────────────────┘
```

Key principle, kept strictly throughout: **the AI never decides what's vulnerable, and never
decides how to fix it.** The scanner produces findings deterministically; a deterministic lookup
table (§2.4) attaches the OWASP category and the fix; the AI Engine is called *after* that, purely
to explain the *impact* of a finding — the one piece of information nothing else on the page
already provides.

---

## 2. Components

### 2.1 Client (React + Vite + Tailwind)
- Auth flow: Login/Register call the real API; JWT + user object stored in `localStorage`,
  hydrated into a plain React `Context` (`context/AuthContext.jsx`) on load. **No Redux** — the
  only global state is "who is logged in," which doesn't justify Redux's overhead.
- React Router routes actually wired: `/login`, `/register`, `/dashboard`,
  `/projects/:projectId/scan`, `/projects/:projectId/history`. (`Report`, `Profile`, `Settings`
  pages exist as unrouted stub components — see §6.)
- `Dashboard` doubles as the "Projects" list AND the account-wide stats view (total projects,
  total scans, average score, high/critical count) — one page, since there's only one entity
  type (Project) today.
- Pages call the API via a single `services/api.js` axios instance with a request interceptor
  that attaches the JWT automatically.

### 2.2 Server (Express)
Organized as independent modules under `src/`, each with its own routes/controller/model:
- `auth` — register, login, JWT, bcrypt (built first)
- `projects` — CRUD for a user's website projects, ownership-scoped
- `scans` — trigger a scan (synchronous, see §2.6) + list history + fetch one scan
- `dashboard` — one aggregation endpoint across all of a user's projects
- `scanner` — the check implementations + scoring/OWASP/remediation (pure functions, no
  Express dependency)
- `ai` — provider interface, two providers (real + fallback), a checkId-based cache, and two
  prompt/output guardrail utilities (see §2.5)
- `utils` — `generateToken.js`, `ssrfGuard.js`

### 2.3 Scanner Engine
A **plain Node module**, not an Express route handler — usable/testable without HTTP or a
database.

```
scanner/
  runScan.js              // SSRF guard -> one fetch -> run all checks in parallel -> score
  checks/
    httpHeaders.js         // missing CSP / X-Frame-Options / X-Content-Type-Options / HSTS
    https.js                // non-HTTPS URL
    cookies.js               // missing Secure / HttpOnly / SameSite
    cors.js                   // Access-Control-Allow-Origin: * (+ credentials)
  owaspMap.js               // checkId -> OWASP Top 10 category
  remediationMap.js          // checkId -> exact, hand-written fix (see §2.4)
  scoring.js                  // findings -> { score, severityCounts, findings w/ owasp+remediation }
```
Each check is `async (url, context) => Finding[]`, run in parallel via `Promise.allSettled` so
one failing check doesn't kill the whole scan. `context` (headers, cookies, final URL) is built
from a single fetch in `runScan.js` — checks never make their own HTTP requests.

Only 4 checks are implemented today (headers/HTTPS/cookies/CORS). The original spec listed 9
(tech detection, robots.txt/sitemap, directory listing, JS secret scanning, TLS certificate
inspection) — deferred, see §6.

### 2.4 Scoring + OWASP Mapping + Remediation
Three pure functions, composed in `scoring.js`:
- `mapToOwasp(checkId)` — deterministic lookup, OWASP Top 10 (2021) category per checkId.
- `getRemediation(checkId)` — deterministic lookup, the *exact* fix (header syntax, cookie
  attribute, etc.) for that checkId. **Never AI-generated** — a fix for a given checkId never
  changes between scans, so generating it fresh via AI would cost tokens for no benefit and risk
  the model getting exact security-config syntax subtly wrong. This belongs in reviewed code, not
  a probabilistic model.
- `scoreFindings(findings)` — applies severity weights, returns `{ score, severityCounts,
  findings }` where each finding now carries `owasp` and `remediation`.

### 2.5 AI Engine — Impact Analysis Only
```
ai/
  AIProvider.js               // interface: explainCheck(check) -> impact text (one issue TYPE)
  providers/
    gemini.js                  // real provider (Google Gemini)
    fallback.js                  // template-based, no API key, cannot fail
  index.js                       // cache-by-checkId orchestrator + report assembly
  promptSanitizer.js              // OWASP LLM01 defense (indirect prompt injection)
  outputSanitizer.js               // OWASP LLM02 defense (insecure output handling)
```
Deliberately narrow scope: the AI's only job is a short, concrete answer to *"what could an
attacker actually do with this?"* — not "what is this" (already shown via the finding's own
title/description) and not "how do I fix it" (§2.4, deterministic). This split exists because an
earlier version had the AI restate the description and improvise a generic fix, which was both
redundant with the findings list and a weaker fix than a hand-written one.

**Caching**: results are cached by `checkId` in MongoDB (`AiExplanationCache`), not per-scan or
per-website. Because there are only ~10 possible checkIds total, the cache saturates almost
immediately — after the first few scans across any website, nearly every future scan makes zero
AI calls. `evidence` (a specific cookie/header value, which differs per scan) is deliberately
excluded from the cached prompt, since including it would make the "one checkId = one reusable
explanation" caching assumption incorrect.

**Guardrails**: `promptSanitizer.js` neutralizes injection-style phrases and strips newlines from
any text before it reaches a prompt (applied to `title`/`description` today as defense-in-depth,
since `evidence` — the one field that's genuinely attacker-influenced — is never sent to the AI
at all). `outputSanitizer.js` strips HTML-tag-shaped content and caps length on every AI response
(real or fallback) before it's cached or displayed.

### 2.6 Scan Execution — Synchronous (not async)
Unlike the original plan, scans run **synchronously inside the request** — `POST
/projects/:id/scans` blocks until the scan (fetch + checks + scoring + AI) is fully done, then
returns the complete `Scan` document. This was a deliberate simplification: a scan takes 1-3
seconds today (one fetch, 4 checks, an AI call that's usually a cache hit), which doesn't yet
justify the complexity of a background job + polling endpoint. Revisit if scans get slower or
more numerous — see §6.

---

## 3. Deployment Architecture (Target — not yet deployed)

| Layer | Where | How |
|---|---|---|
| Frontend | Vercel | auto-deploy on push to `main`, build via Vite |
| Backend | Railway | Docker image, env vars for Mongo URI / JWT secret / Gemini key |
| Database | MongoDB Atlas | already in use for local dev, same cluster works for prod |
| CI/CD | Jenkins | not yet built — see §6 |

---

## 4. Data Flow — End to End (one scan, as actually built)

1. Client: `POST /api/projects/:id/scans` (JWT required)
2. Server: confirm the project belongs to `req.user`, then call `runScan(project.url)`
3. `runScan`: SSRF guard (DNS-resolve, reject private/internal targets) → one `fetch` → run 4
   checks in parallel against the shared response → raw findings
4. `scoreFindings`: attach `owasp` + `remediation` to each finding, compute `score` +
   `severityCounts`
5. `generateExplanation`: for each unique `checkId` in this scan's findings, check
   `AiExplanationCache` → on a miss, call Gemini (fallback to the template provider on any
   failure) → sanitize the result → cache it
6. Assemble the final markdown report: title/OWASP (from checks) + AI impact text (from step 5)
   + remediation (from step 4) — three distinct sources, nothing repeated
7. Save the completed (or failed) `Scan` document, return it in the same HTTP response

---

## 5. Non-Functional Notes

- **Security**: helmet, rate-limiting on scan creation only (`middleware/scanRateLimiter.js`),
  SSRF guard on every scan target, JWT auth on every non-public route, per-user ownership checks
  on every project/scan lookup, AI prompt/output sanitization (§2.5).
- **Cost control**: AI is called at most once per unique checkId per scan, and the checkId cache
  means most scans make zero AI calls at all after the first handful across any website.
- **Testability**: scanner checks, scoring, OWASP mapping, and remediation lookup are all pure
  functions — unit-testable with a hand-built `context` object, no DB/Express/network needed.

---

## 6. Deliberately Not Built Yet

Documented here so it's clear what's a gap vs. what's an intentional v1 boundary:
- Redux, Docker, Jenkins CI/CD
- Async scan queue + polling (scans are synchronous today, see §2.6)
- PDF report export, Profile/Settings pages
- Remaining 5 scanner checks from the original spec (tech detection, robots.txt/sitemap,
  directory listing, JS secret scanning, TLS certificate inspection)
- "Chat with AI about a scan" (multi-turn, scoped conversation)
- Login/register rate limiting (only scan-creation is rate-limited today)
