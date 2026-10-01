# GitHub Automation Bot

An event-driven GitHub automation platform that listens to GitHub Issues and Pull Requests, evaluates configurable rules, and executes durable actions such as GitHub updates, Slack notifications, and AI-powered triage.

The application is built with Next.js and PostgreSQL, uses a GitHub App for repository integration and webhooks, and runs a persistent background worker on Render.

## Live Deployment

**Production:**
https://github-automation-bot-9q2i.onrender.com

**Repository:**
https://github.com/deepeshsingh19/github-automation-bot

---

## Features

- GitHub authentication with NextAuth
- GitHub App installation and repository connection
- Signed GitHub webhook ingestion
- Issue and Pull Request automation
- Configurable rules based on:
  - Title
  - Body
  - Author
- Supported rule operators:
  - Contains
  - Equals
  - Starts With
- Supported actions:
  - Add GitHub label
  - Post GitHub comment
  - Send Slack notification
  - Run AI triage with Google Gemini
- Durable event processing with PostgreSQL
- At-least-once event processing
- Action-level idempotency
- Retry and exponential-style backoff
- Concurrent worker protection using `FOR UPDATE SKIP LOCKED`
- Stale worker lease recovery
- AI result caching
- Encrypted Slack webhook storage
- Production health endpoint
- Authenticated dashboard for repositories, rules, and events
- Event detail pages showing action execution status

---

## Architecture

```text
                       ┌─────────────────────┐
                       │       GitHub        │
                       │ Issues / Pull       │
                       │ Requests / OAuth    │
                       └──────────┬──────────┘
                                  │
                         Signed Webhook
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   Next.js Route Handler  │
                    │ /api/webhooks/github     │
                    │                          │
                    │ HMAC verification        │
                    │ Delivery deduplication   │
                    │ Payload normalization    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      PostgreSQL / Neon   │
                    │                          │
                    │ Users                    │
                    │ Installations            │
                    │ Repositories             │
                    │ Rules                    │
                    │ Events                   │
                    │ Actions                  │
                    └────────────┬─────────────┘
                                 │
                         Claim pending work
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    Background Worker     │
                    │                          │
                    │ FOR UPDATE               │
                    │ SKIP LOCKED              │
                    │                          │
                    │ Rule Engine              │
                    │ Action Executor          │
                    │ Retry / Recovery         │
                    └───────┬─────┬─────┬──────┘
                            │     │     │
                 ┌──────────┘     │     └──────────┐
                 ▼                ▼                ▼
        ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
        │ GitHub REST API│ │ Slack Webhook│ │ Gemini API   │
        │ Labels/Comments│ │ Notifications│ │ AI Triage    │
        └────────────────┘ └──────────────┘ └──────────────┘
```

The webhook handler acknowledges valid requests quickly and persists events before background processing.

The PostgreSQL `events` table acts as the durable queue and source of truth. The background worker processes events asynchronously.

---

## Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS

### Backend

- Next.js Route Handlers
- Node.js
- TypeScript
- NextAuth v4
- Zod

### Database

- PostgreSQL
- Neon
- Prisma 6

### Integrations

- GitHub App
- GitHub REST API
- GitHub Webhooks
- Slack Incoming Webhooks
- Google Gemini API

### Deployment

- Render
- Persistent Node.js application
- PostgreSQL hosted on Neon

---

## Application Flow

### 1. Authentication

Users sign in with GitHub.

The GitHub OAuth credentials are handled through NextAuth and the authenticated session is exposed to the dashboard.

The application keeps the GitHub user access token in the session rather than storing the token in the database.

### 2. GitHub App Installation

The GitHub App is installed separately from normal OAuth login.

Installation creates an `Installation` record associated with the authenticated user.

Repositories are **not automatically connected** when the GitHub App is installed. Users explicitly choose which accessible repositories to connect from the dashboard.

### 3. Repository Connection

A repository can be connected only when:

- The installation belongs to the authenticated user.
- The installation is active.
- GitHub exposes the repository through that installation.
- The user has push or admin permission.

Repository ownership is protected so that one user cannot take over a repository connected to another user.

### 4. Webhook Ingestion

The webhook endpoint is:

```text
POST /api/webhooks/github
```

The webhook flow is:

```text
Receive raw request
        ↓
Verify X-Hub-Signature-256
        ↓
Read X-GitHub-Delivery
        ↓
Validate event type and action
        ↓
Normalize required GitHub fields
        ↓
Insert Event
        ↓
Return HTTP 200
```

Supported webhook events are limited to:

#### Issues

- opened
- edited
- reopened

#### Pull Requests

- opened
- edited
- reopened
- synchronize

Events such as label changes are acknowledged but ignored to prevent automation loops.

### 5. Rule Evaluation

Rules are evaluated against a normalized internal event payload.

Supported match fields:

```text
TITLE
BODY
AUTHOR
```

Supported operators:

```text
CONTAINS
EQUALS
STARTS_WITH
```

The rule engine is a pure function with no network or database access.

Regular expressions are intentionally not supported in order to avoid unnecessary ReDoS risk.

### 6. Action Creation

When rules match, durable `Action` records are created.

Each action has a deterministic `actionKey`.

Examples:

```text
rule:<ruleId>:add_label:<label>
rule:<ruleId>:comment
rule:<ruleId>:slack
ai:triage
```

The database enforces:

```text
UNIQUE(eventId, actionKey)
```

which prevents duplicate action rows.

### 7. Action Execution

Actions are executed in the following order:

```text
1. AI
2. GitHub
3. Slack
```

Supported GitHub actions include:

- Add label
- Add comment

GitHub comments contain an event/action marker so that a retry can detect an already-created comment before issuing another POST request.

### 8. AI Triage

The AI action uses Google Gemini.

Current production model:

```text
gemini-3.5-flash-lite
```

The AI request requires structured JSON containing:

```json
{
  "summary": "Concise issue summary",
  "suggestedLabel": "bug",
  "priority": "high"
}
```

The response is validated with Zod before it is persisted.

AI output is cached on the `Event` record so a worker crash does not unnecessarily trigger another Gemini request.

AI failure is intentionally non-blocking. A failed AI action does not prevent the remaining GitHub and Slack actions from executing.

GitHub issue and pull request content is treated as untrusted data and is not allowed to override the application's instructions.

### 9. Slack Notifications

Slack uses an Incoming Webhook.

Webhook URLs are:

1. Validated when configured.
2. Restricted to `https://hooks.slack.com/services/...`.
3. Encrypted using AES-256-GCM before database storage.
4. Decrypted only when the worker needs to send a notification.
5. Revalidated immediately before sending.

Slack secrets are never returned to the dashboard and are never intentionally written to logs.

### 10. Retry and Recovery

The worker uses durable state transitions:

```text
PENDING
   ↓
PROCESSING
   ↓
DONE
```

Failures can transition to:

```text
FAILED
```

or return to the retry path when the error is transient.

Transient errors include:

- HTTP 429
- HTTP 5xx
- Network failures
- Request timeouts

Permanent errors include:

- HTTP 404
- HTTP 422
- Other non-retryable 4xx responses

Retry delays are:

```text
1 minute
5 minutes
15 minutes
60 minutes
```

A maximum of five attempts is enforced.

Worker leases are fenced using the claimed event timestamp. If a worker loses its lease, it cannot overwrite the state written by a newer worker.

Stale `PROCESSING` events are reclaimable after the configured lease period.

---

## Idempotency

The system is designed for **at-least-once processing**, not exactly-once execution.

There are multiple layers of duplicate protection.

### Event-level idempotency

GitHub's delivery ID is stored as:

```text
githubDeliveryId
```

with a unique constraint.

Repeated delivery of the same webhook therefore does not create another event.

### Action-level idempotency

Actions use:

```text
UNIQUE(eventId, actionKey)
```

so the same logical action cannot be inserted twice.

### GitHub comment idempotency

GitHub comments include an internal marker:

```text
<!-- bot:<eventId>:<actionKey> -->
```

The worker searches for an existing matching comment before creating a new one.

### AI idempotency

AI results are stored directly on the Event:

```text
aiSummary
aiSuggestedLabel
aiPriority
```

so a recovered worker can reuse the previous result.

---

## Concurrency

Multiple worker executions may run concurrently.

Event claiming uses PostgreSQL row locking with:

```sql
FOR UPDATE SKIP LOCKED
```

This allows multiple workers to safely compete for work without processing the same event simultaneously.

The worker also has an in-process overlap guard.

---

## External Cron Backstop

The application exposes:

```text
POST /api/internal/sweep
```

This endpoint requires the configured `SWEEP_SECRET`.

The endpoint provides an operational backstop that can wake the worker and drain pending or retryable events.

This is useful for recovering work when the normal worker loop has not run recently.

---

## Health Check

The application exposes:

```text
GET /api/health
```

This endpoint is intended for deployment and operational health checks.

Production:

```text
https://github-automation-bot-9q2i.onrender.com/api/health
```

---

## Project Structure

```text
github-automation-bot/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── github/setup/
│   │   │   ├── health/
│   │   │   ├── internal/sweep/
│   │   │   └── webhooks/github/
│   │   │
│   │   ├── dashboard/
│   │   │   ├── events/
│   │   │   ├── repositories/
│   │   │   └── rules/
│   │   │
│   │   ├── login/
│   │   └── page.tsx
│   │
│   ├── components/
│   │   └── dashboard/
│   │
│   ├── db/
│   ├── lib/
│   ├── server/
│   │   ├── actions/
│   │   ├── auth/
│   │   ├── crypto/
│   │   ├── github/
│   │   ├── rules/
│   │   ├── slack/
│   │   └── worker/
│   │
│   └── types/
│
├── tests/
├── instrumentation.ts
├── render.yaml
├── package.json
└── README.md
```

---

## Local Development

### Prerequisites

- Node.js 24+
- npm
- PostgreSQL-compatible database
- GitHub App
- GitHub OAuth credentials
- Slack Incoming Webhook
- Gemini API key for AI functionality

### Install dependencies

```bash
npm ci
```

### Generate Prisma Client

```bash
npx prisma generate
```

### Apply migrations

```bash
npx prisma migrate dev
```

### Start development server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

## Environment Variables

Create a local `.env` file.

Required variables:

```env
APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

DATABASE_URL=
DIRECT_URL=

AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

ENCRYPTION_KEY=
SWEEP_SECRET=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite

WORKER_ENABLED=true
```

Generate a suitable authentication secret:

```bash
openssl rand -base64 32
```

Generate a 32-byte encryption key:

```bash
openssl rand -base64 32
```

Do not commit `.env` or any API keys, private keys, webhook URLs, or secrets.

---

## GitHub App Configuration

The production GitHub App should be configured with the deployed application URL.

### Homepage URL

```text
https://github-automation-bot-9q2i.onrender.com
```

### OAuth callback URL

```text
https://github-automation-bot-9q2i.onrender.com/api/auth/callback/github
```

### Setup URL

```text
https://github-automation-bot-9q2i.onrender.com/api/github/setup
```

### Webhook URL

```text
https://github-automation-bot-9q2i.onrender.com/api/webhooks/github
```

### GitHub App permissions

The current application requires:

- Repository metadata: Read-only
- Issues: Read and write
- Pull requests: Read-only

### GitHub App events

- Issues
- Pull requests

Push events are intentionally disabled.

---

## Production Deployment

The application is deployed as a persistent Node.js service on Render.

The Render deployment uses the repository's `render.yaml`.

### Build command

```bash
npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build
```

### Start command

```bash
npm start
```

The production process runs:

```bash
next start
```

The background worker starts within the same persistent Node.js process when:

```env
WORKER_ENABLED=true
```

is configured.

---

## Testing

The project contains unit, integration, security, authorization, and operational tests.

Run the full test suite:

```bash
npm test -- --run
```

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

The current test suite covers:

- Webhook signature validation
- Webhook event filtering
- Duplicate webhook delivery
- Rule evaluation
- Action deduplication
- GitHub action execution
- Slack execution
- AI execution
- Retry behavior
- Concurrent event claiming
- Stale event recovery
- Worker lease fencing
- Authorization boundaries
- GitHub installation lifecycle
- Operational sweep endpoint
- Worker integration

---

## Security Considerations

### Webhook verification

GitHub webhook signatures are verified using HMAC SHA-256 and a timing-safe comparison before processing a request.

### Replay protection

GitHub delivery IDs are stored uniquely to prevent processing the same delivery more than once.

### Authorization

Repository and installation operations are scoped to the authenticated user.

Users cannot connect repositories belonging to another user.

### Secret handling

Sensitive values are never returned to the browser.

Slack webhook URLs are encrypted before persistence.

GitHub App private keys and other secrets are read from environment variables.

### SSRF protection

Slack webhook configuration accepts only HTTPS URLs on:

```text
hooks.slack.com
```

Unexpected ports, usernames, passwords, or paths are rejected.

### GitHub content isolation

GitHub issue and pull request content is considered untrusted user-generated data.

AI instructions explicitly separate application instructions from GitHub content.

### Error handling

External HTTP failures are classified explicitly as transient or permanent.

Secrets and authentication tokens are not stored inside action responses.

---

## Operational Characteristics

The worker is intentionally designed around a durable PostgreSQL queue instead of relying on an in-memory queue.

This provides:

- Persistence across application restarts
- Retry support
- Concurrent processing protection
- Crash recovery
- Durable action state
- Observability through stored event and action records

The system follows an **at-least-once delivery model** with explicit idempotency protections.

A hard distributed exactly-once guarantee is not assumed.

---

## Production Verification

The production deployment has been manually verified for:

- GitHub authentication
- GitHub App installation flow
- Repository connection
- Signed GitHub webhook ingestion
- Durable event creation
- Background worker processing
- GitHub automation
- Slack notification delivery
- Gemini AI triage
- Event and action status tracking

Gemini production testing was performed using:

```text
gemini-3.5-flash-lite
```

The production Slack integration successfully delivered a real notification.

The production Gemini integration successfully generated a real AI triage response.

---

## Future Improvements

Potential extensions include:

- Multiple repositories per installation
- Additional event types
- More rule operators
- Richer AI triage workflows
- GitHub checks and review automation
- Additional notification providers
- Dedicated worker infrastructure
- Metrics and distributed tracing
- More granular role and permission management

---

## License

This project was developed as a software engineering take-home project.