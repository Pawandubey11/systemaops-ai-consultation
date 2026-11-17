# SystemaOps AI Consultation Platform

Production-ready consultation intake application for SystemaOps. Clients select services, provide company and project information, and receive an AI-generated solution recommendation and downloadable PDF report.

The frontend uses plain HTML, CSS, and JavaScript. The backend uses Node.js and Express. Dify provides AI orchestration, and MongoDB can provide persistent storage.

## Main features

- Responsive four-step consultation form
- Multiple service selection and service-specific questions
- Client-side review before submission
- Dify Chatflow or Workflow integration
- Structured and validated AI recommendations
- Consultation reference numbers
- Browser report view and professional PDF download
- Optional MongoDB persistence
- Development-only deterministic fallback
- Request rate limiting, retry handling, timeouts, health checks, and structured logs
- Docker deployment support

## How the system works

```text
Client browser
    |
    | POST /api/consultations
    v
Node.js / Express API
    |-- validates input
    |-- applies per-IP rate limit
    |-- sends the structured request to Dify
    v
Dify Chatflow or Workflow
    |-- LLM analysis
    |-- knowledge-base retrieval (when configured in Dify)
    |-- structured JSON response
    v
Express response validator
    |-- MongoDB or in-memory development store
    |-- web report
    `-- downloadable PDF
```

The Dify API key remains on the server. It is never sent to browser JavaScript.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend | Node.js 22, Express |
| AI orchestration | Dify Cloud or self-hosted Dify |
| Database | MongoDB with an in-memory development fallback |
| PDF | Python 3 and ReportLab |
| Container | Docker and Docker Compose |
| Testing | Node.js built-in test runner |

## Project structure

```text
.
|-- public/                       Website UI, styles, JavaScript, and logo
|-- lib/
|   |-- dify-client.js            Dify API client, retries, and timeout handling
|   |-- analysis-schema.js        AI output normalization and validation
|   `-- demo-analysis.js          Development fallback generator
|-- scripts/
|   `-- generate_consultation_pdf.py
|-- test/                         Automated Dify integration tests
|-- docs/
|   |-- DIFY_WORKFLOW.md          Detailed Dify application configuration
|   `-- ARCHITECTURE_MIGRATION.md Architecture and migration notes
|-- server.js                     Express API and persistence
|-- Dockerfile
|-- docker-compose.yml
|-- .env.example                  Safe configuration template
`-- package.json
```

## Prerequisites

For local development:

- Node.js 20 or newer (Node.js 22 recommended)
- npm
- Python 3 with ReportLab for PDF generation
- A published Dify application and its application API key
- MongoDB only when persistent storage is required

Install ReportLab locally if it is not already available:

```bash
python -m pip install reportlab
```

Docker users do not need to install Python or ReportLab separately because the Docker image includes them.

## Quick start on Windows

1. Extract the project ZIP.
2. Open PowerShell in the extracted directory.
3. Install dependencies:

```powershell
npm install
```

4. Create the local environment file:

```powershell
Copy-Item .env.example .env
```

5. Open `.env` and add the Dify application API key.
6. Validate and start the application:

```powershell
npm run check
npm test
npm start
```

7. Open `http://localhost:3000/#consultation`.

Use `npm run dev` instead of `npm start` when you want the server to restart automatically after code changes.

## Environment configuration

Never commit `.env` or send it inside a project ZIP. Use `.env.example` as the template.

```dotenv
PORT=3000
MONGODB_URI=
CONSULTATION_EMAIL=hello@systemaops.com
PDF_PYTHON=
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_API_KEY=app-your-dify-application-key
DIFY_APP_TYPE=chatflow
DIFY_INPUT_NAME=consultation_json
DIFY_OUTPUT_NAME=analysis
DIFY_TIMEOUT_MS=90000
DIFY_MAX_RETRIES=2
DIFY_FALLBACK_ENABLED=true
CONSULTATION_RATE_LIMIT=10
CORS_ORIGINS=http://localhost:3000,https://systemaops.com
```

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | Web server port; default is `3000` |
| `MONGODB_URI` | Production | MongoDB connection string; blank uses temporary memory storage |
| `CONSULTATION_EMAIL` | No | SystemaOps contact email shown in generated material |
| `PDF_PYTHON` | No | Python executable path; useful when Python is not on `PATH` |
| `DIFY_BASE_URL` | Yes | Dify API base URL ending in `/v1` |
| `DIFY_API_KEY` | Yes | Published Dify application API key beginning with `app-` |
| `DIFY_APP_TYPE` | Yes | `chatflow` or `workflow` |
| `DIFY_INPUT_NAME` | Workflow | Workflow input variable containing consultation JSON |
| `DIFY_OUTPUT_NAME` | Workflow | Workflow output variable containing analysis JSON |
| `DIFY_TIMEOUT_MS` | No | Maximum Dify request duration; default is 90 seconds |
| `DIFY_MAX_RETRIES` | No | Retry count for temporary Dify failures |
| `DIFY_FALLBACK_ENABLED` | No | Enables demo output when Dify is unavailable; use `false` in production |
| `CONSULTATION_RATE_LIMIT` | No | Maximum submissions per IP address per minute |

If `MONGODB_URI` is blank, consultations disappear when the server restarts. Always configure MongoDB for production.

## Configure Dify Cloud

1. Sign in to Dify and create a **Chatflow** application.
2. Install and configure an approved model provider, or use available Dify model credits.
3. Add an LLM node and configure it to analyze the consultation request.
4. Require the LLM to return JSON only.
5. Optionally add Knowledge Retrieval nodes for the SystemaOps service catalog, previous projects, pricing, policies, architecture standards, and delivery documentation.
6. Test the flow in Preview with a sample consultation.
7. Publish the Chatflow.
8. Open **API Access** and create an application API key.
9. Put that key in `DIFY_API_KEY` inside `.env`.
10. Set `DIFY_APP_TYPE=chatflow`.

For a Dify Workflow application, set `DIFY_APP_TYPE=workflow` and make sure the configured input and output variable names match `DIFY_INPUT_NAME` and `DIFY_OUTPUT_NAME`.

The expected AI output contains:

- `executiveSummary`
- `proposedSolution`
- `technologyStack`
- `architecture`
- `roadmap`
- `aiOpportunities`
- `security`
- `risks`
- `assumptions`
- `nextSteps`
- `disclaimer`

See [docs/DIFY_WORKFLOW.md](docs/DIFY_WORKFLOW.md) for the recommended prompt, JSON contract, RAG configuration, and publishing checklist.

## Run commands

```bash
npm start       # production-style start
npm run dev     # start with Node watch mode
npm run check   # JavaScript syntax checks
npm test        # automated tests
```

## API reference

### Health check

```http
GET /api/health
```

Example response:

```json
{
  "ok": true,
  "database": "mongodb",
  "ai": {
    "provider": "dify",
    "configured": true,
    "fallbackEnabled": false
  }
}
```

### Available services

```http
GET /api/services
```

### Submit a consultation

```http
POST /api/consultations
Content-Type: application/json
```

Example request:

```json
{
  "schemaVersion": "1.0",
  "contact": {
    "name": "Jane Client",
    "email": "jane@example.com"
  },
  "company": {
    "name": "Example Company",
    "industry": "Professional Services",
    "size": "11-50",
    "website": "https://example.com",
    "description": "A growing service-based company"
  },
  "services": ["website-development", "cloud-infrastructure"],
  "project": {
    "challenges": "No modern customer-facing website",
    "goals": "Create and deploy a scalable website on AWS",
    "existingSystems": "Microsoft 365",
    "timeline": "3 months",
    "budget": "$10,000-$25,000",
    "erpEdition": null,
    "requirements": "Responsive design, CMS, analytics, backups, and monitoring"
  },
  "consent": {
    "accepted": true,
    "acceptedAt": "2026-01-01T10:00:00.000Z"
  }
}
```

The response includes a reference such as `CON-2026-761B13A9` and the structured analysis. Dify processing can take 30-60 seconds depending on the selected model and workflow.

### Retrieve a consultation

```http
GET /api/consultations/:reference
```

### Download the PDF

```http
GET /api/consultations/:reference/pdf
```

Example: `http://localhost:3000/api/consultations/CON-2026-761B13A9/pdf`

## Docker deployment

1. Create `.env` and configure the production values.
2. Build and start:

```bash
docker compose up --build -d
```

3. Check container status and logs:

```bash
docker compose ps
docker compose logs -f consultation-app
```

4. Stop the application:

```bash
docker compose down
```

The included Compose file deploys this consultation application only. It does not install Dify or MongoDB. Use Dify Cloud, or deploy self-hosted Dify separately using Dify's official versioned deployment. Use a managed MongoDB service or add an appropriately secured MongoDB deployment.

## Production deployment checklist

- Set `NODE_ENV=production`.
- Set `DIFY_FALLBACK_ENABLED=false`.
- Configure a persistent `MONGODB_URI`.
- Store `.env` values in the hosting platform's secret manager.
- Put the application behind HTTPS and a reverse proxy/load balancer.
- Restrict access to database and internal services.
- Configure backups, retention, monitoring, and alerts.
- Review Dify model and knowledge-base permissions.
- Apply an appropriate Content Security Policy for the final hosting domain.
- Run `npm run check` and `npm test` before deployment.
- Verify a real submission, record retrieval, and PDF download after deployment.

## Troubleshooting

### The form remains on “Submitting your consultation”

Dify analysis normally takes 30-60 seconds. Check the server terminal for a `dify_workflow_succeeded` or failure log. Confirm the Dify app is published, the model has available credits, and `DIFY_TIMEOUT_MS` is at least `90000`.

### Dify authentication error

Confirm `DIFY_API_KEY` is an **application API key**, not a model-provider key. It normally starts with `app-`. Restart the Node server after changing `.env`.

### Dify returns invalid or incomplete output

Test the application in Dify Preview. Make the prompt require JSON only and include every field in the expected output contract. Do not surround the JSON with Markdown code fences.

### PDF download fails

Run `python --version` and `python -m pip show reportlab`. Install ReportLab if missing. On Windows, set `PDF_PYTHON` to the full Python executable path when Python is not available on `PATH`.

### Consultation cannot be found after restart

The server is using its in-memory development store. Configure `MONGODB_URI` for persistent records.

### Port 3000 is already in use

Change `PORT` in `.env`, for example `PORT=3001`, restart the server, and open the corresponding URL.

### Confirm the active configuration

Open `/api/health`. Production should report `configured: true`, `provider: "dify"`, and `fallbackEnabled: false`.

## Security guidance

- Never put the Dify key in `public/app.js`, HTML, or frontend configuration.
- Never commit or share `.env`.
- Rotate a key immediately if it is exposed.
- Use separate Dify keys and environments for development and production.
- Validate and sanitize all external knowledge-base documents.
- Apply least-privilege access to Dify, MongoDB, deployment, and CI/CD accounts.
- Avoid logging client-sensitive form contents.
- Define consultation data retention and deletion policies.
- Review privacy notices and consent wording for the countries where the service operates.

## Verification completed for this project

- Live Dify Chatflow submission succeeded
- Structured AI response was received and stored
- Consultation retrieval succeeded
- PDF generation and download succeeded
- Dify fallback was disabled during live verification
- Automated tests passed
- JavaScript syntax checks passed

## Additional documentation

- [Dify workflow and RAG setup](docs/DIFY_WORKFLOW.md)
- [Architecture and Dify migration](docs/ARCHITECTURE_MIGRATION.md)

## Recent changes (v1.1.0)

- **Polling timeout extended** — frontend now waits up to 5 minutes (was 1 minute) to match the server's maximum Dify retry window (90s × 3 retries)
- **DIFY_FALLBACK_ENABLED defaults to true** — temporary Dify outages no longer break the entire form for users
- **CORS middleware added** — configurable via `CORS_ORIGINS` env var; allows multiple domains
- **Response compression** — all API responses gzip-compressed via `compression` middleware
- **Rate limiting** — replaced custom rate limiter with `express-rate-limit`; separate stricter limit on PDF generation
- **Cache-Control headers** — `/api/services` cached for 5 minutes; consultation and PDF endpoints set `no-store`
- **MongoDB in Docker Compose** — `docker-compose.yml` now includes a MongoDB 7 service with health check and persistent volume
- **robots.txt** — added `public/robots.txt` to allow crawlers on `/` and block `/api/`
- **Report fade-in** — smooth opacity + translate animation when the AI report section is revealed
- **XSS hardening** — all dynamic content in `renderReport()` and `renderServices()` now routed through `escapeHtml()`
- **Startup warnings** — server logs a clear warning on startup when `MONGODB_URI` is missing
- **Python path** — removed hardcoded Windows Python path from server; uses env var or `python3` default

## License and ownership

This repository is an internal SystemaOps project. Add the organization's approved license and usage policy before public distribution.
