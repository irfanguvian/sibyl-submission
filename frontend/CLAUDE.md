# Frontend — Tuition Web

Next.js 15 (App Router) client for the Tuition platform. Parents manage cases and invite tutors; tutors maintain a profile and browse cases. All backend traffic flows through a server-side BFF proxy that holds auth tokens in httpOnly cookies.

## Stack

- **Next.js 15** App Router, **React 19**, TypeScript 5.5, Node 22
- **TanStack Query v5** for server state
- **react-hook-form** + **zod** (`@hookform/resolvers`) for forms/validation
- **Tailwind CSS v4** (PostCSS) + **Radix UI** primitives + **lucide-react** icons; `cva` + `tailwind-merge` for variants
- **Biome** for lint/format, **Vitest** + Testing Library (jsdom) for tests
- **pnpm** package manager (`pnpm@10.33.0`); `output: "standalone"` build

## Commands

```bash
pnpm dev        # next dev (http://localhost:3000)
pnpm build      # next build (standalone)
pnpm start      # next start
pnpm test       # vitest run (jsdom)
pnpm lint       # biome check .
pnpm format     # biome format --write .
pnpm gen:types  # openapi-typescript from backend /docs-json → src/lib/api-types.gen.ts (backend must be running)
```

Run a single test: `pnpm vitest run src/components/__tests__/case-form.test.tsx`.

## Layout

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    login/  cases/  cases/[id]  cases/[id]/edit  cases/new  tutors/  tutors/[id]  profile/
    api/
      auth/{login,logout,me,refresh}/route.ts   # BFF: token exchange, sets/clears httpOnly cookies
      proxy/[...path]/route.ts                   # authenticated reverse proxy to the backend
  lib/
    api.ts          # typed client (casesApi, tutorsApi, uploadDocument) — calls /api/proxy
    api-types.ts    # hand-maintained types; api-types.gen.ts is generated from OpenAPI
    auth-server.ts  # server-only: cookie helpers, BACKEND_URL, backendFetch
    use-auth.ts use-cases.ts use-tutors.ts  # TanStack Query hooks
    schemas.ts      # zod form schemas
    utils.ts        # cn() etc.
  components/
    case-form.tsx dashboard-shell.tsx states.tsx
    ui/             # button, sheet (Radix-based primitives)
    __tests__/
  providers/query-provider.tsx   # QueryClientProvider
  test/setup.ts                  # vitest/Testing Library setup
```

## BFF / auth architecture (important)

The browser **never** holds JWTs and never talks to the backend directly.

1. `/api/auth/login` (route handler) calls the backend, receives `{ accessToken, refreshToken, expiresIn }`, and writes them to **httpOnly cookies** (`tuition_access`, `tuition_refresh`) via `auth-server.ts`.
2. All data calls go to `/api/proxy/<path>` (`proxy/[...path]/route.ts`), which attaches the access cookie as `Authorization: Bearer`, forwards to `BACKEND_URL`, and **silently refreshes once on a 401** (rotating cookies), then retries.
3. Multipart/binary bodies stream through unchanged; backend redirects (e.g. presigned document downloads) pass through.

So: client code uses `lib/api.ts` (→ `/api/proxy`), never `BACKEND_URL`. Only server-side route handlers import `auth-server.ts`. `BACKEND_URL` is the backend as seen from the **Next server**, not the browser (`http://localhost:3001` default; `backend:3001` in Docker).

## Conventions

- **Data fetching**: TanStack Query hooks in `lib/use-*.ts` wrapping `lib/api.ts`. Don't `fetch` the backend ad hoc from components.
- **Forms**: react-hook-form + zod resolver; schemas in `lib/schemas.ts`.
- **Imports**: `@/` alias maps to `src/`.
- **Styling**: Tailwind utilities + `cn()` (`lib/utils.ts`); Radix primitives wrapped in `components/ui`.
- **Server vs client**: components are Server Components by default; add `"use client"` only where needed (forms, query hooks, interactivity).
- Two-space indent, double quotes, semicolons — Biome (`biome.json`). Run `pnpm lint` before done.
- Tests colocated in `__tests__/` as `*.test.tsx`.

## Local dev

Set `BACKEND_URL` (server-side) to reach the API; default `http://localhost:3001`. Run the backend first (and `pnpm gen:types` against its `/docs-json` to refresh API types). Full stack via the repo-root `docker-compose.yml`.
