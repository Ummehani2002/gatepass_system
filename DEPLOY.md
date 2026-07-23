# Deploy Gate Pass with shared Postgres (free)

> Prefer AWS? Use **[DEPLOY-AWS.md](./DEPLOY-AWS.md)** (EC2 + Docker).

This app has two parts:

1. **Frontend** (Next.js) — deploy on [Vercel](https://vercel.com)
2. **API + DB** (`gatepass-backend`) — Postgres on [Neon](https://neon.tech), API on [Render](https://render.com)

When `NEXT_PUBLIC_API_URL` is set, all users share the same database.
When it is empty, the UI uses browser `localStorage` (demo only).

## 1. Neon (database)

1. Create a free Neon project.
2. Copy the connection string.
3. From your machine:

```bash
cd gatepass-backend
cp .env.example .env
```

Set in `.env`:

- `DATABASE_URL` = Neon connection string
- `PGSSL=true`
- `JWT_SECRET` = long random string

Then:

```bash
npm install
npm run db:setup
npm run db:seed
```

Seed logins:

- `admin` / `admin123`
- `garden` / `garden123`

Change these passwords after go-live.

## 2. Render (API)

1. New **Web Service** → connect this GitHub repo.
2. **Root Directory:** `gatepass-backend`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Environment variables:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon URL |
| `PGSSL` | `true` |
| `JWT_SECRET` | same as above |
| `CORS_ORIGIN` | your Vercel URL (or `*` for first test) |

6. Open `https://YOUR-SERVICE.onrender.com/api/health` — should return `{ "ok": true, "db": "up" }`.

## 3. Vercel (UI)

1. Import the same GitHub repo (root = project root, not `gatepass-backend`).
2. Environment variables:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-SERVICE.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL |

Do **not** set `AUTH_SECRET` for Gate Pass-only deploy (TaskFlow leftover middleware stays off).

3. Deploy → open the Vercel URL → log in with seed users.

## 4. Verify shared DB

1. Log in as `admin` on computer A, create a gate pass.
2. Log in as `garden` on computer B — the gate pass should appear.

## Local API mode

```bash
# terminal 1 — API
cd gatepass-backend
npm install
npm run db:setup   # needs local Postgres or Neon
npm run db:seed
npm run dev

# terminal 2 — UI
cd ..
cp .env.example .env   # set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

Open http://localhost:3000
