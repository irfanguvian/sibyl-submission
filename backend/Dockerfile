# syntax=docker/dockerfile:1
# Build context: ./backend (standalone service)

FROM node:22-slim AS base
# openssl is required by Prisma's query engine; without it `prisma generate`
# defaults to the openssl-1.1.x engine, which fails to load on this (3.x) image.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ── deps (all) ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── build ──────────────────────────────────────────────────────────────────--
FROM deps AS build
COPY . .
# Generate Prisma client (offline — no DB needed)
RUN pnpm exec prisma generate
RUN pnpm build

# ── prod deps (pruned, with generated Prisma client) ────────────────────────--
# pnpm symlinks @prisma/client from the virtual store, so `prisma generate`
# writes the client into node_modules/.pnpm/...; there is no top-level
# node_modules/.prisma to cherry-pick. Generate against a full install, then
# prune dev deps in place so the generated client (a prod dep) survives.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
RUN pnpm prune --prod

# ── runner ─────────────────────────────────────────────────────────────────--
FROM node:22-slim AS runner
# openssl needed at runtime to load the Prisma query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./

USER node
EXPOSE 3001
CMD ["node", "dist/main"]
