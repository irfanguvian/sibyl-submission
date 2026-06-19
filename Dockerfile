# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Combined single-container image for Railway (one service).
#   • NestJS backend  — internal only, listens on 127.0.0.1:3001
#   • Next.js frontend — public, listens on $PORT (injected by Railway)
# The browser only ever talks to Next.js (same-origin BFF at /api/*); Next.js
# proxies to the backend over localhost. Object storage is external (R2/S3),
# Postgres is external. start.sh runs `prisma migrate deploy` then boots both.
#
# Build context = repo root (needs both ./backend and ./frontend).
# ─────────────────────────────────────────────────────────────────────────────

# ── Backend build ────────────────────────────────────────────────────────────
FROM node:22-slim AS backend-build
# openssl: Prisma query engine needs it (3.x image → openssl-3 engine).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ .
RUN pnpm exec prisma generate
RUN pnpm build

# ── Frontend build ───────────────────────────────────────────────────────────
FROM node:22-slim AS frontend-build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Backend runtime: compiled dist, node_modules (kept UN-pruned so the Prisma CLI
# is available for `migrate deploy` at boot), plus schema + migrations.
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/prisma ./backend/prisma
COPY --from=backend-build /app/backend/package.json ./backend/package.json

# Frontend runtime: Next.js standalone bundle (server.js + minimal node_modules),
# static assets, and public/. Mirrors frontend/Dockerfile layout.
COPY --from=frontend-build /app/frontend/.next/standalone ./frontend
COPY --from=frontend-build /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-build /app/frontend/public ./frontend/public

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Railway injects $PORT for the public process (Next.js). 3000 is the local default.
EXPOSE 3000
CMD ["./start.sh"]
