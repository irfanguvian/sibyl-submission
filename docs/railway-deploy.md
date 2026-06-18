# Railway deploy — single container

Backend (NestJS) and frontend (Next.js) ship in **one image** (root `Dockerfile`).
Postgres and object storage (Cloudflare R2) are **external**.

## How the one container works

```
Browser ──▶ Next.js (public, $PORT)
               │  same-origin BFF: /api/auth/*, /api/proxy/*
               ▼
            NestJS (internal, 127.0.0.1:3001)
               ├─▶ Postgres   (external, DATABASE_URL)
               └─▶ R2 / S3    (external, S3_ENDPOINT)

Document download: NestJS returns a 302 to a presigned R2 URL → proxy passes it
through → the browser downloads straight from R2.
```

The browser never talks to the backend directly, so only the Next.js port is
exposed. `start.sh` runs `prisma migrate deploy`, boots the backend on `:3001`,
waits for it to answer, then starts Next.js on Railway's `$PORT`.

## One-time setup

1. **Postgres** — add a Postgres service (Railway plugin or external). Copy its
   connection string.
2. **R2 bucket** — create a bucket (e.g. `documents`) and an R2 API token
   (Access Key ID + Secret). Note your account S3 endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Service** — create a Railway service from this repo. Railway auto-detects
   the root `Dockerfile` / `railway.toml`.

## Service variables

Set these on the Railway service (values are examples — use your own):

| Variable              | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://user:pass@host:port/db`                     |
| `DATABASE_DIRECT_URL` | same as `DATABASE_URL` (the Prisma schema requires it)    |
| `JWT_SECRET`          | a 64+ char random string                                  |
| `NODE_ENV`            | `production`                                              |
| `CORS_ORIGINS`        | `https://YOUR-APP.up.railway.app`                         |
| `BACKEND_URL`         | `http://127.0.0.1:3001`                                   |
| `S3_ENDPOINT`         | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`           |
| `S3_REGION`           | `auto`                                                    |
| `S3_BUCKET`           | `documents`                                               |
| `S3_ACCESS_KEY`       | R2 access key id                                          |
| `S3_SECRET_KEY`       | R2 secret access key                                      |
| `S3_FORCE_PATH_STYLE` | `true`                                                    |

Do **not** set `PORT` (Railway injects it for the public Next.js process).
Leave `S3_PUBLIC_ENDPOINT` and `NEXT_PUBLIC_API_URL` **unset** — the R2 account
endpoint is browser-reachable, and the browser only ever calls Next.js.

## Build / run locally (parity check)

```bash
docker build -t tuition .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL=postgresql://... -e DATABASE_DIRECT_URL=postgresql://... \
  -e JWT_SECRET=dev-secret-please-change \
  -e NODE_ENV=production \
  -e CORS_ORIGINS=http://localhost:8080 \
  -e BACKEND_URL=http://127.0.0.1:3001 \
  -e S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  -e S3_REGION=auto -e S3_BUCKET=documents \
  -e S3_ACCESS_KEY=... -e S3_SECRET_KEY=... -e S3_FORCE_PATH_STYLE=true \
  tuition
# open http://localhost:8080
```

> Local day-to-day dev is unchanged: use the root `docker-compose.yml`
> (Postgres + MinIO + split services). This image is for deploy only.

## Resource note

Two Node processes share the container (~250–400 MB RAM). Fits Railway's small
instances but is tighter than two separate services — bump the plan if the
service OOM-restarts under load.
