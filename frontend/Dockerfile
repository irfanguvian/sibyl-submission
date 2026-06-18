# syntax=docker/dockerfile:1
# Build context: ./frontend (standalone service)

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ── deps ───────────────────────────────────────────────────────────────────--
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── build ──────────────────────────────────────────────────────────────────--
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── runner (Next standalone output) ────────────────────────────────────────--
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
