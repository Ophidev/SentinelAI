# SentinelAI — High Level Design (HLD)

Version: 1.0 — 2026-07-10
Scope: aligns with `SENTINELAI_MASTER_SPEC.md`, tailored to the actual stack the developer
knows (React, Redux Toolkit, Tailwind, Vite, React Router, Node/Express, MongoDB, Docker, Jenkins).
Deliberately excludes: shadcn/ui, Kubernetes, multi-provider AI abstraction — all deferred until needed.

---

## 1. System Overview

SentinelAI is a full-stack SaaS app where a user submits a public website URL and gets back:
- a deterministic security scan (headers, cookies, CORS, TLS, tech fingerprint, exposed files/secrets)
- an OWASP Top 10 mapping
- a 0–100 security score
- an AI-generated, plain-English explanation of the findings + remediation steps
- persisted history so scores can be tracked over time per project

The system is split into 4 logical engines behind one Express API:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React SPA)                       │
│   Auth Pages · Dashboard · Projects · Scan Trigger · Report UI  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST (axios, JWT bearer)
┌───────────────────────────▼──────────────────────────────────────┐
│                     Express API (server)                        │
│  ┌───────────┐ ┌────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │   Auth     │ │  Projects  │ │  Scan Engine    │ │  AI Engine │ │
│  │  Module    │ │  Module    │ │  (deterministic)│ │ (explain)  │ │
│  └───────────┘ └────────────┘ └────────────────┘ └────────────┘ │
│                       │                │                 │      │
│                       ▼                ▼                 ▼      │
│                 ┌─────────────────────────────────────────┐     │
│                 │      Scoring + OWASP Mapping Layer       │     │
│                 └─────────────────────────────────────────┘     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                 ┌──────────▼──────────┐
                 │   MongoDB Atlas      │
                 │ Users/Projects/Scans │
                 └──────────────────────┘
```

Key principle from the spec, kept strictly: **the AI never decides what's vulnerable.**
The scanner produces findings deterministically; the AI Engine is called *after* scoring, purely
to translate findings into human language. This keeps the core product testable, deterministic,
and cheap to run (AI is one call per scan, not N calls per check).

---

## 2. Components

### 2.1 Client (React + Vite + Tailwind)
- Auth flow: Login/Register, JWT stored in memory + refresh via httpOnly cookie (see LLD §3).
- Redux Toolkit: only for `auth` slice (current user, token) and `activeProject` slice.
  Everything else (scan lists, reports) is fetched per-page — no global cache duplication.
- React Router: `/`, `/login`, `/register`, `/dashboard`, `/projects/:id`, `/projects/:id/scan/:scanId`,
  `/projects/:id/history`, `/profile`, `/settings`.
- Pages call the API via a single `services/api.js` axios instance with an interceptor for the JWT.

### 2.2 Server (Express)
Organized as independent modules under `src/`, each with its own routes/controller/model:
- `auth` — already built (register, login, JWT, bcrypt)
- `projects` — CRUD for a user's website projects
- `scans` — trigger + poll scan status, list scans for a project
- `scanner` — the actual check implementations (pure functions, no Express dependency)
- `ai` — one `AIProvider` interface + one implementation, called once scoring is done
- `reports` — PDF export of a scan

### 2.3 Scanner Engine
A **plain Node module**, not an Express route handler — this is the most important architectural
decision: it must be usable/testable without HTTP or a database.

```
scanner/
  runScan(url) -> Promise<RawFindings[]>
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
```
Each check is `async (url) => Finding[]`, run in parallel via `Promise.allSettled` so one failing
check (e.g. site blocks bots) doesn't kill the whole scan.

### 2.4 Scoring + OWASP Mapping
Pure function: `RawFindings[] -> { score, owaspBuckets, severityCounts }`. Deterministic lookup
table maps each check/finding type to an OWASP Top 10 (2021) category and a severity weight.

### 2.5 AI Engine
```
ai/
  AIProvider.js        // interface: explain(findings, scoreSummary) -> ExplanationText
  providers/ollama.js  // first implementation (free, local, good for dev/demo)
  providers/openai.js  // second implementation (swap via env var)
```
Called exactly once per completed scan. Output is stored alongside the scan, not regenerated
on every page view (avoids repeat API cost).

### 2.6 Async Scan Execution
A scan takes several seconds (multiple network checks). The API returns immediately with a
`scanId` and status `pending`; the scan runs in the background (in-process job, no external queue
needed at this scale — Bull/Redis is a future upgrade, not needed now) and updates status to
`completed`/`failed`. Client polls `GET /scans/:id` every few seconds.

---

## 3. Deployment Architecture

| Layer | Where | How |
|---|---|---|
| Frontend | Vercel | auto-deploy on push to `main`, build via Vite |
| Backend | Railway | Docker image, env vars for Mongo URI / JWT secret / AI provider keys |
| Database | MongoDB Atlas | free-tier cluster, IP allowlist for Railway |
| CI/CD | Jenkins | pipeline: install → lint → test → docker build → push → (trigger Railway deploy hook) |
| Containerization | Docker | separate `Dockerfile` for client (nginx-served static build) and server (node:alpine) |

Kubernetes is explicitly **not** part of v1 — noted in the spec as a future item, and not part of
the developer's current toolkit. Revisit once there's more than one backend instance to manage.

---

## 4. Data Flow — End to End (one scan)

1. Client: `POST /api/projects/:id/scans` → server creates `Scan{status:"pending"}`, returns `scanId`
2. Server (background): `runScan(project.url)` → raw findings
3. Server: score + OWASP mapping → `Scan.score`, `Scan.owasp`, `Scan.findings`
4. Server: `AIProvider.explain(findings, score)` → `Scan.aiExplanation`
5. Server: `Scan.status = "completed"`
6. Client: polling `GET /api/scans/:scanId` sees `completed`, renders Report page
7. Client: `GET /api/scans/:scanId/report.pdf` for export (LLD §6)

---

## 5. Non-Functional Requirements

- **Security**: helmet, rate-limiting on `/scans` (prevent abuse of scanning as a proxy/DoS vector),
  input validation on URLs (must be http/https, reject internal/private IP ranges — SSRF guard,
  see LLD §7), JWT expiry + refresh.
- **Cost control**: AI called once per scan, not per finding; cache identical repeated scans within
  a short window (optional, later).
- **Testability**: scanner checks are pure functions — unit-testable with mocked HTTP responses,
  no DB/Express needed.
