# TaskFlow

A minimal, production-ready multi-tenant project/task tracker (Linear/Asana-lite),
built as a startup MVP that can scale to millions of users without an
architecture rewrite. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full
system design, database schema, API reference, and scaling path.

## Stack

- **Next.js 15** (App Router) — UI + REST API in one deployable unit
- **PostgreSQL + Drizzle ORM** — typed schema, SQL migrations
- **Custom JWT sessions** (`jose` + httpOnly cookies) — no third-party auth dependency
- **Tailwind CSS** — small set of design primitives, no heavy component library
- **Upstash Redis** (optional) — rate limiting, with an in-memory fallback for local dev

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Postgres

Any Postgres works — [Neon](https://neon.tech) (recommended, generous free tier,
serverless autoscaling) or a local Postgres via Docker:

```bash
docker run --name taskflow-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 4. Run migrations and seed data

```bash
npm run db:generate   # only needed after changing src/lib/db/schema.ts
npm run db:migrate
npm run db:seed        # optional: creates demo@taskflow.dev / password123
```

### 5. Start the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`, register an account, and you'll land in a new
organization's workspace.

## Verifying a production build

```bash
npm run typecheck
npm run build
```

This project has been verified end-to-end against a real Postgres-protocol
database: registration, login/logout, organization + membership management,
project/task CRUD, kanban status drag, comments, RBAC enforcement (403 on
under-privileged actions), cross-tenant isolation (404 instead of leaking
another org's data), and auth rate limiting (429 after repeated attempts)
all behave as specified in ARCHITECTURE.md.

## Project structure

See [ARCHITECTURE.md § File Structure](./ARCHITECTURE.md#2-file-structure).

## Deploying

1. Push to GitHub, import into [Vercel](https://vercel.com).
2. Set `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (and optionally
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) as environment
   variables.
3. Run `npm run db:migrate` against the production database (e.g. from CI, or
   once locally with the production `DATABASE_URL`) before first deploy.

## What's intentionally out of scope for v1

These are straightforward additions once there's a real user base to justify
them — building them now would be speculative:

- **Invite-by-email for non-existing users.** Adding a member today requires
  they already have a TaskFlow account. A real invite flow (signed invite
  token + email via Resend) is the natural next step.
- **Background jobs / queue.** All work happens inline within the request.
  Fine at MVP traffic; see ARCHITECTURE.md's scaling path for when to
  introduce Inngest/QStash.
- **Billing/subscriptions.** No Stripe integration yet — add it once you have
  paying-customer demand to validate pricing against.
- **Realtime updates.** Kanban board state is per-browser-tab; no
  WebSocket/SSE sync across multiple viewers yet.
