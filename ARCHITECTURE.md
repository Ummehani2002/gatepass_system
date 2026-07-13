# TaskFlow — System Architecture

Multi-tenant project/task management SaaS (Linear/Asana-lite). Built to be
minimal at MVP stage, with every major decision chosen so it doesn't have to
be re-architected at 10x or 100x scale — only re-configured or split out.

## 1. System Architecture

```
                              ┌─────────────────────┐
                              │        Users          │
                              └──────────┬────────────┘
                                          │ HTTPS
                                          ▼
                          ┌───────────────────────────────┐
                          │   Vercel Edge Network / CDN     │
                          │   (static assets, edge cache)   │
                          └───────────────┬────────────────┘
                                          │
                                          ▼
                  ┌───────────────────────────────────────────┐
                  │              Next.js App (Vercel)            │
                  │  ┌─────────────────┐  ┌───────────────────┐  │
                  │  │  React Server     │  │  API Route Handlers │  │
                  │  │  Components (UI)  │  │  (REST, /api/*)     │  │
                  │  └─────────────────┘  └─────────┬─────────┘  │
                  │            middleware.ts (auth + tenant)      │
                  └────────────────────────┬───────────────────────┘
                                          │
                ┌────────────────────────┼─────────────────────────┐
                ▼                        ▼                         ▼
      ┌──────────────────┐   ┌───────────────────────┐   ┌──────────────────┐
      │   PostgreSQL        │   │   Upstash Redis          │   │   Resend (email)   │
      │   (Neon, autoscaling)│   │   (rate limiting, cache) │   │   transactional     │
      │   Drizzle ORM        │   └───────────────────────┘   └──────────────────┘
      └──────────────────┘
                ▲
                │ (future, when write volume demands it)
      ┌──────────────────┐
      │  Read replicas /    │
      │  PgBouncer pooling  │
      └──────────────────┘
```

**Why this shape:**

- **Next.js App Router on Vercel** — one deployable unit for UI + API at MVP
  stage (no separate frontend/backend to coordinate or version). API route
  handlers are plain REST, so the backend can be lifted out into a standalone
  Node/Fastify service later without rewriting business logic — route
  handlers are thin wrappers around `lib/` functions that don't import
  anything Next.js-specific.
- **Postgres as the only system of record.** Strong consistency for billing,
  membership, and permissions data matters more at this stage than the
  flexibility of NoSQL. Neon/RDS give you connection pooling and read
  replicas without re-platforming.
- **Multi-tenancy: shared schema, `organization_id` on every tenant-owned
  row.** This is the standard scalable pattern (Slack, Linear, Notion all
  start this way). It supports millions of small/medium tenants on one
  database; you only need to graduate to schema-per-tenant or
  database-per-tenant if you land a small number of very large enterprise
  customers with compliance requirements — and at that point you migrate the
  handful of big tenants, not the whole system.
- **Stateless compute.** Route handlers hold no in-process state (sessions
  are JWT in an httpOnly cookie, not server memory), so the app horizontally
  scales by adding serverless function instances — no sticky sessions, no
  shared in-memory cache to worry about.
- **Redis is optional at MVP.** Rate limiting and caching both have an
  in-memory fallback for local dev / single instance; Upstash Redis is a
  drop-in env var away for multi-instance production.
- **Async work (email, webhooks) is isolated behind a `lib/jobs` boundary.**
  At MVP it runs inline (e.g. send email, don't block on it failing). When
  volume grows, swap the implementation for a queue (Inngest/QStash) without
  touching call sites.

### Scaling path (what changes, in order, as traffic grows)

1. **10x:** add Redis-backed rate limiting + caching (already wired, just set
   env vars). Add DB connection pooling (Neon does this automatically;
   self-hosted Postgres needs PgBouncer).
2. **100x:** add a read replica for dashboard/list queries; keep writes on
   the primary. Move transactional email and webhook delivery to a real
   queue (Inngest/QStash) so a slow downstream provider can't block a
   request.
3. **1000x+:** shard the largest tenants into dedicated databases (the
   `organization_id` column already makes this a data-migration problem, not
   a code-rewrite problem). Split the API route handlers out of the Next.js
   app into a dedicated service if compute needs diverge from the frontend's.

## 2. File Structure

```
taskflow/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx        # public landing page
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── (dashboard)/[orgSlug]/
│   │   │   ├── layout.tsx              # sidebar + org switcher
│   │   │   ├── page.tsx                # project list / dashboard
│   │   │   ├── projects/[projectId]/page.tsx  # kanban board
│   │   │   └── settings/page.tsx       # members + org settings
│   │   ├── api/
│   │   │   ├── auth/{register,login,logout}/route.ts
│   │   │   ├── organizations/route.ts
│   │   │   ├── organizations/[orgId]/route.ts
│   │   │   ├── organizations/[orgId]/members/route.ts
│   │   │   ├── organizations/[orgId]/projects/route.ts
│   │   │   ├── projects/[projectId]/route.ts
│   │   │   ├── projects/[projectId]/tasks/route.ts
│   │   │   ├── tasks/[taskId]/route.ts
│   │   │   └── tasks/[taskId]/comments/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              # button, input, card, badge — design primitives
│   │   ├── tasks/           # TaskCard, KanbanBoard, TaskDialog
│   │   ├── projects/        # ProjectCard, ProjectList
│   │   └── layout/          # Sidebar, OrgSwitcher, Topbar
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts    # Drizzle schema (source of truth for DB shape)
│   │   │   ├── index.ts     # Drizzle client singleton
│   │   │   ├── migrate.ts   # runs pending migrations
│   │   │   └── seed.ts      # dev seed data
│   │   ├── auth/
│   │   │   ├── session.ts   # JWT sign/verify, cookie helpers
│   │   │   └── password.ts  # bcrypt hash/compare
│   │   ├── validations/     # zod schemas per resource
│   │   ├── permissions.ts   # RBAC: role checks (owner/admin/member)
│   │   ├── rate-limit.ts    # Upstash-backed, in-memory fallback
│   │   └── api-helpers.ts   # typed JSON responses, error formatting
│   ├── hooks/                # client-side React Query-style hooks
│   ├── types/                 # shared TS types (DTOs)
│   └── middleware.ts          # auth gate + tenant resolution
├── drizzle/migrations/         # SQL migration files (generated)
├── drizzle.config.ts
├── .env.example
└── package.json
```

## 3. Database Schema

Entity-relationship summary:

```
users ──┐
        │ 1:N (membership)
        ▼
memberships ──N:1── organizations ──1:N── projects ──1:N── tasks ──1:N── comments
   (role)                                                     │
                                                               └─N:1── users (assignee)
```

Tables (see `src/lib/db/schema.ts` for the exact Drizzle definitions):

- **users** — `id, email (unique), password_hash, name, avatar_url, created_at, updated_at`
- **organizations** — `id, name, slug (unique), owner_id, created_at, updated_at`
- **memberships** — `id, user_id, organization_id, role (owner|admin|member), created_at`, unique on `(user_id, organization_id)`
- **projects** — `id, organization_id, name, description, created_by, created_at, updated_at`
- **tasks** — `id, project_id, organization_id, title, description, status (todo|in_progress|done), priority (low|medium|high), assignee_id, created_by, due_date, created_at, updated_at`
- **comments** — `id, task_id, author_id, body, created_at`
- **sessions** — `id, user_id, token_hash, expires_at, created_at` (revocable JWT sessions)

Design notes:

- `organization_id` is denormalized onto `tasks` (not just reachable via
  `project_id → projects.organization_id`) specifically so every tenant-scoped
  query and every index can filter on it directly with no join. This is the
  single most important index for multi-tenant performance at scale.
- Every foreign key that crosses a tenant boundary cascades on delete
  (`ON DELETE CASCADE` for org → projects → tasks → comments) so deleting an
  org never leaves orphaned rows.
- Composite index `(organization_id, status)` on `tasks` supports the kanban
  board's primary query (status columns within one project/org) without a
  full table scan as row counts grow.

## 4. API Endpoints

All routes are namespaced under `/api`, return JSON, and are protected by
`middleware.ts` (session required) plus per-route membership/role checks.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create user + first organization | Public |
| POST | `/api/auth/login` | Verify credentials, set session cookie | Public |
| POST | `/api/auth/logout` | Clear session | Session |
| GET | `/api/organizations` | List orgs the current user belongs to | Session |
| POST | `/api/organizations` | Create a new organization | Session |
| GET | `/api/organizations/:orgId` | Get org details | Member |
| PATCH | `/api/organizations/:orgId` | Update org name/slug | Admin+ |
| DELETE | `/api/organizations/:orgId` | Delete org | Owner |
| GET | `/api/organizations/:orgId/members` | List members | Member |
| POST | `/api/organizations/:orgId/members` | Invite/add member by email | Admin+ |
| DELETE | `/api/organizations/:orgId/members/:memberId` | Remove member | Admin+ |
| GET | `/api/organizations/:orgId/projects` | List projects in org | Member |
| POST | `/api/organizations/:orgId/projects` | Create project | Member |
| GET | `/api/projects/:projectId` | Get project | Member |
| PATCH | `/api/projects/:projectId` | Update project | Member |
| DELETE | `/api/projects/:projectId` | Delete project | Admin+ |
| GET | `/api/projects/:projectId/tasks` | List tasks (kanban data) | Member |
| POST | `/api/projects/:projectId/tasks` | Create task | Member |
| GET | `/api/tasks/:taskId` | Get task detail | Member |
| PATCH | `/api/tasks/:taskId` | Update task (status, assignee, etc.) | Member |
| DELETE | `/api/tasks/:taskId` | Delete task | Member |
| GET | `/api/tasks/:taskId/comments` | List comments | Member |
| POST | `/api/tasks/:taskId/comments` | Add comment | Member |

Every mutating handler validates its body with a Zod schema from
`lib/validations/` and returns `400` with field errors on failure, `401` if
unauthenticated, `403` if authenticated but lacking the required role, and
`404` if the resource isn't visible to the caller's tenant (never leaking
existence of another org's data).

## 5. UI Architecture

- **Route groups** separate concerns: `(marketing)` is the public site,
  `(auth)` is unauthenticated login/register, `(dashboard)/[orgSlug]` is the
  authenticated, tenant-scoped app shell.
- **Server Components by default** for data fetching (project lists, task
  lists are fetched directly from the DB in the page component — no
  client-side waterfall on first load). **Client Components** are used only
  where interactivity is required: the kanban board (drag/optimistic status
  updates), forms, and the org switcher dropdown.
- **`[orgSlug]` in the URL is the tenant boundary in the UI**, mirroring
  `organization_id` in the DB — every dashboard page reads the org from the
  URL, resolves it to an `organization_id` once in the layout, and passes it
  down, so there's one place tenant scoping can leak from, not many.
- **Design system:** a small set of Tailwind-based primitives
  (`components/ui/button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`) rather
  than a heavy component library — enough consistency for an MVP without the
  bundle size or customization fights of a full kit.
- **State:** server state lives in Postgres and is read via Server
  Components; the few client-side interactions (status drag, optimistic
  comment add) use local component state + `fetch` to the REST API, no
  global state library needed yet.

## 6. Security & Multi-Tenancy Guarantees

- Passwords hashed with bcrypt (cost factor 12), never logged or returned in
  any API response.
- Sessions are JWTs signed with `AUTH_SECRET` (HS256 via `jose`), stored in
  an httpOnly, `SameSite=Lax`, `Secure` (in prod) cookie — not readable by
  client JS, mitigating XSS token theft.
- Every DB query that touches tenant data is scoped by `organization_id`
  derived from the authenticated user's verified membership — never trusted
  from client input alone (a `projectId` in a URL still gets its
  `organization_id` checked against the caller's memberships before any read
  or write).
- Rate limiting on auth endpoints (`/api/auth/*`) to slow down credential
  stuffing/brute force.
