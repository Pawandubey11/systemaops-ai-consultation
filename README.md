# SystemaOps AI Consultation Platform

> **Status:** ✅ All 5 automated tests pass · ✅ All endpoints verified locally · ✅ PDF generation working · ✅ Docker-ready

Production-ready AI consultation intake platform for SystemaOps. Clients select services, provide company and project details, and receive a structured AI-generated technology roadmap with a downloadable PDF report — in minutes.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [Technology stack](#technology-stack)
3. [Project structure](#project-structure)
4. [All API endpoints](#all-api-endpoints)
5. [Quick start — Windows (local)](#quick-start--windows-local)
6. [Quick start — Linux / macOS](#quick-start--linux--macos)
7. [Environment variables](#environment-variables)
8. [Dify AI setup](#dify-ai-setup)
9. [Demo mode (no Dify required)](#demo-mode-no-dify-required)
10. [Docker deployment](#docker-deployment)
11. [Running tests](#running-tests)
12. [Production deployment checklist](#production-deployment-checklist)
13. [Security](#security)
14. [Troubleshooting](#troubleshooting)
15. [Recent changes](#recent-changes)

---

## How it works

```
Browser (4-step form)
  │
  │  POST /api/consultations
  ▼
Node.js / Express API
  ├─ Validates input
  ├─ Applies per-IP rate limit
  ├─ Saves record (MongoDB or in-memory)
  ├─ Returns reference immediately (202)
  └─ Calls Dify AI async
        │
        │  If Dify succeeds  →  structured JSON analysis stored
        │  If Dify fails     →  deterministic fallback analysis stored
        ▼
Browser polls GET /api/consultations/:reference every 2.5 s (up to 5 min)
  └─ When status = "analysis_ready" → renders report + PDF download
```

The **Dify API key is never sent to the browser**. It lives only on the server.

---

## Technology stack

| Layer            | Technology                                      |
|------------------|-------------------------------------------------|
| Frontend         | HTML5, CSS3, Vanilla JavaScript (no framework)  |
| Backend          | Node.js 20+, Express 4                          |
| Security         | Helmet (CSP), CORS, express-rate-limit          |
| Compression      | compression (gzip)                              |
| AI orchestration | Dify Cloud or self-hosted Dify (Chatflow / Workflow) |
| Database         | MongoDB 7 (optional — in-memory fallback for dev) |
| PDF              | Python 3 + ReportLab                            |
| Container        | Docker + Docker Compose                         |
| Testing          | Node.js built-in test runner (5 tests)          |

---

## Project structure

```
systemaops-ai-consultation/
├── public/                         Static frontend served by Express
│   ├── index.html                  Single-page application
│   ├── app.js                      Frontend logic (form, polling, report)
│   ├── styles.css                  All styles (responsive, dark hero)
│   ├── robots.txt                  Crawler rules
│   └── assets/
│       └── systemaops-logo.png     Brand logo
├── lib/
│   ├── dify-client.js              Dify API client (retry, timeout, auth)
│   ├── analysis-schema.js          AI output normalizer and validator
│   └── demo-analysis.js            Deterministic fallback AI (no Dify needed)
├── scripts/
│   └── generate_consultation_pdf.py  PDF generator (Python + ReportLab)
├── test/
│   └── dify-client.test.js         Automated tests (5 tests)
├── docs/
│   ├── DIFY_WORKFLOW.md            Dify app setup guide
│   └── ARCHITECTURE_MIGRATION.md   Architecture notes
├── server.js                       Express server and all API routes
├── Dockerfile                      Production container build
├── docker-compose.yml              App + MongoDB services
├── .env.example                    Safe configuration template
├── .gitignore                      Excludes .env, node_modules, outputs
└── package.json
```

---

## All API endpoints

### `GET /api/health`
Server and configuration status.

**Response:**
```json
{
  "ok": true,
  "database": "memory",
  "ai": {
    "provider": "dify",
    "configured": true,
    "fallbackEnabled": true
  }
}
```

---

### `GET /api/services`
Returns all 12 service offerings. Cached for 5 minutes.

**Response:**
```json
{
  "services": [
    { "code": "website-development", "name": "Website Development", "description": "Fast, conversion-focused web platforms." },
    { "code": "mobile-app-development", "name": "Mobile App Development", "description": "..." },
    ...
  ]
}
```

**Available service codes:**

| Code | Name |
|------|------|
| `website-development` | Website Development |
| `mobile-app-development` | Mobile App Development |
| `crm-development` | CRM Development |
| `erp-solutions` | ERP Solutions |
| `ai-automation` | AI Automation |
| `ai-chatbots` | AI Chatbots |
| `cloud-infrastructure` | Cloud Infrastructure |
| `devops` | DevOps & CI/CD |
| `data-engineering` | Data Engineering |
| `api-development` | API Development |
| `ui-ux-design` | UI/UX Design |
| `custom-software` | Custom Software |

---

### `POST /api/consultations`
Submit a new consultation. Rate limited to 10 per minute per IP.

**Request body:**
```json
{
  "schemaVersion": "1.0",
  "contact": {
    "name": "Pawan Dubey",
    "email": "pawan@example.com"
  },
  "company": {
    "name": "Acme Corp",
    "industry": "Manufacturing",
    "size": "51-200",
    "website": "https://acme.com",
    "description": "A growing manufacturing company"
  },
  "services": ["ai-automation", "cloud-infrastructure"],
  "project": {
    "challenges": "Manual processes slow us down",
    "goals": "Automate operations and move to cloud",
    "existingSystems": "SAP ERP, Microsoft 365",
    "timeline": "3 months",
    "budget": "INR 10-25 Lakh",
    "erpEdition": null,
    "requirements": "Scalable cloud with AI workflow automation"
  },
  "consent": {
    "accepted": true,
    "acceptedAt": "2026-11-17T10:00:00.000Z"
  }
}
```

**Response `202 Accepted`:**
```json
{
  "reference": "CON-2026-EA5781C8-B25C-471D-AA20-D8EBC6144131",
  "status": "processing"
}
```

**Error responses:**
- `422` — missing required fields
- `429` — rate limit exceeded

---

### `GET /api/consultations/:reference`
Poll for consultation status. No-store cache.

**Possible `status` values:**

| Status | Meaning |
|--------|---------|
| `processing` | AI analysis in progress |
| `analysis_ready` | Complete — `analysis` field is populated |
| `failed` | Dify failed and fallback is disabled |

**Response when ready:**
```json
{
  "reference": "CON-2026-...",
  "status": "analysis_ready",
  "analysis": {
    "mode": "deterministic-fallback",
    "executiveSummary": "Acme Corp wants to automate operations...",
    "proposedSolution": ["Human-supervised AI automation workflow", "..."],
    "technologyStack": ["Dify", "Node.js", "AWS", "..."],
    "architecture": ["Responsive HTML/CSS/JS client", "..."],
    "roadmap": [
      { "phase": 1, "name": "Automation discovery", "duration": "1-2 weeks" },
      { "phase": 2, "name": "AI pilot and evaluation", "duration": "2-4 weeks" }
    ],
    "aiOpportunities": ["..."],
    "security": ["..."],
    "risks": ["..."],
    "assumptions": ["..."],
    "nextSteps": ["..."],
    "disclaimer": "..."
  }
}
```

---

### `GET /api/consultations/:reference/pdf`
Download the consultation as a PDF. Rate limited to 5 per minute per IP.

**Response:** `application/pdf` binary stream  
**Filename:** `SystemaOps-CON-2026-....pdf`

---

## Quick start — Windows (local)

### Prerequisites
- [Node.js 20+](https://nodejs.org/) (22 recommended)
- [Python 3](https://python.org/) with ReportLab

```powershell
# Check Node.js version
node --version   # should be v20 or higher

# Install ReportLab (once)
python -m pip install reportlab
```

### Setup

```powershell
# 1. Clone
git clone https://github.com/Pawandubey11/systemaops-ai-consultation.git
cd systemaops-ai-consultation

# 2. Install dependencies
npm install

# 3. Create .env from template
Copy-Item .env.example .env
```

### Configure `.env`

Open `.env` and fill in:

```dotenv
PORT=3000
MONGODB_URI=                        # leave blank → uses in-memory store (dev mode)
CONSULTATION_EMAIL=hello@systemaops.com
PDF_PYTHON=python                   # use "python" on Windows, "python3" on Linux/macOS
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_API_KEY=                       # paste your Dify app API key here (see Dify setup)
DIFY_APP_TYPE=chatflow
DIFY_INPUT_NAME=consultation_json
DIFY_OUTPUT_NAME=analysis
DIFY_TIMEOUT_MS=90000
DIFY_MAX_RETRIES=2
DIFY_FALLBACK_ENABLED=true          # true = works even without a valid Dify key (demo mode)
CONSULTATION_RATE_LIMIT=10
CORS_ORIGINS=http://localhost:3000,https://systemaops.com
```

> **No Dify key?** That's fine — set `DIFY_FALLBACK_ENABLED=true` and the demo analysis will run automatically. See [Demo mode](#demo-mode-no-dify-required).

### Run

```powershell
# Check syntax of all JS files
npm run check

# Run tests
npm test

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

For auto-reload during development:
```powershell
npm run dev
```

---

## Quick start — Linux / macOS

```bash
# 1. Clone
git clone https://github.com/Pawandubey11/systemaops-ai-consultation.git
cd systemaops-ai-consultation

# 2. Install dependencies
npm install

# 3. Install ReportLab
pip3 install reportlab

# 4. Configure
cp .env.example .env
# Edit .env with your values (use PDF_PYTHON=python3)

# 5. Check, test, start
npm run check
npm test
npm start
```

Open **http://localhost:3000**

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `MONGODB_URI` | Production | _(blank)_ | MongoDB connection string. Blank = in-memory dev store |
| `CONSULTATION_EMAIL` | No | `hello@systemaops.com` | Contact email shown in generated materials |
| `PDF_PYTHON` | No | `python3` | Python executable. Use `python` on Windows if `python3` is not on PATH |
| `DIFY_BASE_URL` | Yes (if using Dify) | `https://api.dify.ai/v1` | Dify API base URL |
| `DIFY_API_KEY` | Yes (if using Dify) | _(blank)_ | Application API key — starts with `app-` |
| `DIFY_APP_TYPE` | Yes | `chatflow` | `chatflow` or `workflow` |
| `DIFY_INPUT_NAME` | Workflow only | `consultation_json` | Input variable name in Dify workflow |
| `DIFY_OUTPUT_NAME` | Workflow only | `analysis` | Output variable name in Dify workflow |
| `DIFY_TIMEOUT_MS` | No | `90000` | Per-attempt timeout in milliseconds |
| `DIFY_MAX_RETRIES` | No | `2` | Retry count on timeout or 5xx errors |
| `DIFY_FALLBACK_ENABLED` | No | `true` | `true` = use deterministic fallback if Dify fails |
| `CONSULTATION_RATE_LIMIT` | No | `10` | Max consultation submissions per minute per IP |
| `CORS_ORIGINS` | No | localhost origins | Comma-separated list of allowed CORS origins |

---

## Dify AI setup

Dify provides the AI analysis. You can use [Dify Cloud](https://cloud.dify.ai) (free tier available) or self-host.

### Steps

1. Create a Dify account at [cloud.dify.ai](https://cloud.dify.ai)
2. Create a new **Chatflow** application (recommended) or **Workflow**
3. Add the system prompt from [`docs/DIFY_WORKFLOW.md`](docs/DIFY_WORKFLOW.md)
4. Publish the app
5. Go to **API Access** and copy your **Application API Key** (starts with `app-`)
6. Paste it into `.env` as `DIFY_API_KEY=app-xxxxxxxxxxxxxxxx`
7. Restart the server

### What Dify must return

Your Dify prompt must instruct the LLM to return **only a JSON object** (no Markdown fences) with these fields:

```json
{
  "executiveSummary": "string",
  "proposedSolution": ["string"],
  "technologyStack": ["string"],
  "architecture": ["string"],
  "roadmap": [{ "phase": 1, "name": "string", "duration": "string" }],
  "aiOpportunities": ["string"],
  "security": ["string"],
  "risks": ["string"],
  "assumptions": ["string"],
  "nextSteps": ["string"],
  "disclaimer": "string"
}
```

See [`docs/DIFY_WORKFLOW.md`](docs/DIFY_WORKFLOW.md) for the full prompt template.

---

## Demo mode (no Dify required)

The platform works **without any Dify key** using the built-in deterministic fallback.

Set in `.env`:
```dotenv
DIFY_FALLBACK_ENABLED=true
```

What happens:
- Form submission → server accepts it
- Server tries Dify → fails (no key) → automatically uses `lib/demo-analysis.js`
- Demo analysis generates a real, structured report based on the selected services
- PDF download works identically
- The report shows `mode: "deterministic-fallback"` and `disclaimer` notes it is not a real AI response

This is perfect for local development, testing, and demos.

---

## Docker deployment

Docker Compose runs both the Node.js app and MongoDB together.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Setup

```bash
# 1. Create .env from template
cp .env.example .env     # or: Copy-Item .env.example .env  (Windows)

# 2. Edit .env — set DIFY_API_KEY and other production values
```

### Run

```bash
# Build and start all services (app + MongoDB)
docker compose up --build -d

# View logs
docker compose logs -f consultation-app

# Check status
docker compose ps

# Stop
docker compose down

# Stop and remove all data (volumes)
docker compose down -v
```

The app will be available at **http://localhost:3000**

### What Docker Compose includes

| Service | Image | Purpose |
|---------|-------|---------|
| `consultation-app` | Built from `Dockerfile` | Node.js Express API + static frontend |
| `mongodb` | `mongo:7` | Persistent database with health check |

MongoDB data is persisted in the `mongo_data` Docker volume. It survives `docker compose down` but is deleted with `docker compose down -v`.

### Docker environment

In Docker mode, `MONGODB_URI` is automatically set to:
```
mongodb://mongodb:27017/systemaops
```

The app waits for MongoDB to pass its health check before starting.

---

## Running tests

```bash
# Run all 5 automated tests
npm test

# Check JavaScript syntax on all files
npm run check
```

### Test coverage

| # | Test |
|---|------|
| 1 | Normalizes Dify JSON string output to the report contract |
| 2 | Sends workflow request with server-side bearer authentication |
| 3 | Retries retryable Dify failures (5xx, timeout) |
| 4 | Supports the Dify Chatflow app contract |
| 5 | Rejects incomplete workflow output before it reaches the frontend |

---

## Production deployment checklist

- [ ] `NODE_ENV=production` is set
- [ ] `DIFY_API_KEY` is set to a real, rotated application key
- [ ] `DIFY_FALLBACK_ENABLED=false` (disable demo mode in production)
- [ ] `MONGODB_URI` points to a managed MongoDB instance (Atlas, etc.)
- [ ] `.env` is **not** committed to git and is stored in a secrets manager
- [ ] Application is behind HTTPS + reverse proxy (nginx, Caddy, etc.)
- [ ] `CORS_ORIGINS` is set to your exact production domain(s)
- [ ] `CONSULTATION_RATE_LIMIT` is tuned for expected traffic
- [ ] Database backups and retention configured
- [ ] `npm run check` passes
- [ ] `npm test` passes (all 5)
- [ ] Real end-to-end form submission tested after deployment
- [ ] PDF download verified after deployment
- [ ] `/api/health` returns `configured: true, fallbackEnabled: false`

---

## Security

| Area | Implementation |
|------|---------------|
| API key | Dify key never leaves the server — not in HTML, JS, or logs |
| Input validation | Required fields validated on every POST |
| Rate limiting | 10 req/min on consultations, 5 req/min on PDFs |
| Security headers | Helmet with strict CSP, referrer policy |
| CORS | Configured allowed origins; rejects others |
| XSS | All dynamic HTML uses `escapeHtml()` |
| PDF subprocess | Killed after 30 s timeout |
| Credentials | Never commit `.env`; rotate keys if exposed |
| Separation | Development keys ≠ production keys |

---

## Troubleshooting

### Form stays on "Submitting…" forever

Dify analysis normally takes 30–90 s. The browser polls for up to **5 minutes**.

Check server logs for `dify_workflow_succeeded` or `dify_workflow_failed`.

If you see `dify_workflow_failed`:
- Confirm `DIFY_API_KEY` is a **published** application key (starts with `app-`)
- Confirm the Dify app is published (not in draft)
- Confirm the model in your Dify app has available quota
- Set `DIFY_FALLBACK_ENABLED=true` to use demo mode while you debug

### PDF download fails

```powershell
# Windows
python --version
python -m pip show reportlab

# Linux/macOS
python3 --version
python3 -m pip show reportlab
```

Install ReportLab if missing:
```bash
pip install reportlab       # Windows
pip3 install reportlab      # Linux/macOS
```

Then set `PDF_PYTHON=python` (Windows) or `PDF_PYTHON=python3` (Linux) in `.env`.

### "MONGODB_URI is not set" warning on startup

This is expected in development. The server uses in-memory storage. Data is lost when the server restarts. Set `MONGODB_URI` for persistent storage.

### Port 3000 already in use

```dotenv
PORT=3001
```

Then open `http://localhost:3001`

### CORS errors in browser

Add your frontend URL to `CORS_ORIGINS` in `.env`:
```dotenv
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
```

### Dify returns invalid output

Test your Dify prompt in Dify Preview. The LLM must return **only** a JSON object — no Markdown code fences, no explanation text. See [`docs/DIFY_WORKFLOW.md`](docs/DIFY_WORKFLOW.md).

### Docker: MongoDB not connecting

```bash
docker compose logs mongodb
docker compose ps
```

MongoDB needs ~15 s to initialize. The app health check waits automatically.

---

## Recent changes (v1.1.0)

- **Polling timeout 120s → 300s** — matches server maximum (90s × 3 retries)
- **DIFY_FALLBACK_ENABLED defaults to true** — Dify outages no longer break the form
- **CORS middleware** — configurable via `CORS_ORIGINS` env var
- **Response compression** — gzip via `compression` middleware
- **Rate limiting** — `express-rate-limit` (PDF: 5/min, consultations: configurable)
- **Cache-Control** — `/api/services` cached 5 min; consultations/PDFs: `no-store`
- **MongoDB in Docker Compose** — Mongo 7 service with health check + volume
- **robots.txt** — allows `/`, disallows `/api/`
- **Report fade-in** — smooth opacity + translate animation on report reveal
- **XSS hardening** — all dynamic content via `escapeHtml()`
- **PDF_PYTHON env var** — removed hardcoded Windows Python path
- **Startup warnings** — clear log when MONGODB_URI missing
- **Helmet CSP** — allows Google Fonts domains properly
- **Full UUID references** — unguessable `CON-2026-<UUID>` format

---

## License

Internal SystemaOps project. Add the organization's approved license before public distribution.
