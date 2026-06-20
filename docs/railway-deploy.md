# Railway Deploy — Single Container

The app ships as **one Railway service** built from the root [`Dockerfile`](../Dockerfile).
Inside that single container:

- **NestJS backend** runs on an internal port (`127.0.0.1:3001`) — never exposed publicly.
- **Next.js frontend** runs on the public `$PORT` (injected by Railway) and proxies all
  API traffic to the backend over localhost via its BFF route (`/api/proxy/*`).

Boot order is handled by [`start.sh`](../start.sh): run Prisma migrations → start the
backend → wait for backend health (`/docs-json`) → start the frontend → tear the
container down (so Railway restarts) if either process exits.

## Live URLs

| What | URL |
|---|---|
| App | https://sibyl-submission-production.up.railway.app/ |
| Swagger UI | https://sibyl-submission-production.up.railway.app/api/proxy/docs |
| OpenAPI JSON | https://sibyl-submission-production.up.railway.app/api/proxy/docs-json |

> Because the backend is internal-only, Swagger is reached **through the frontend
> proxy** at `/api/proxy/docs`. Running locally exposes it directly at
> `http://localhost:3001/docs`.

## Build & deploy config

[`railway.toml`](../railway.toml):

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

Provision **Postgres** as a separate Railway plugin/service and **Cloudflare R2**
(S3-compatible) for object storage. Both are wired in through environment variables.

## Required environment variables

Set these as Railway **service variables** (never commit them). `PORT` is injected by
Railway automatically — do **not** set it yourself.

| Variable | Example / Notes |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:PORT/DB` |
| `DATABASE_DIRECT_URL` | Same value as `DATABASE_URL` (Prisma schema requires it) |
| `JWT_SECRET` | 64+ char random string |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://YOUR-APP.up.railway.app` |
| `BACKEND_URL` | `http://127.0.0.1:3001` (frontend → backend over localhost) |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `documents` |
| `S3_ACCESS_KEY` | R2 access key id |
| `S3_SECRET_KEY` | R2 secret access key |
| `S3_FORCE_PATH_STYLE` | `true` |

Notes:
- `NEXT_PUBLIC_API_URL` is unused in production (the browser talks only to Next) — leave unset.
- `S3_PUBLIC_ENDPOINT` is unset in production: R2's account endpoint is already
  browser-reachable, so the dev-only MinIO presign split is not needed.

## Seeding demo data

The deployment is seeded with the accounts listed in the README
[Demo Credentials](../README.md#demo-credentials) (all use `password123`). To reseed a
fresh database, run `pnpm db:seed` from `backend/` against the target `DATABASE_URL`.
