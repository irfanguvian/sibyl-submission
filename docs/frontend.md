# Frontend Architecture

The frontend is a standalone **Next.js 15 (App Router)** project in `frontend/`. It
has no dependency on the backend source — it talks to the NestJS API over HTTP and
derives its contract types from the backend's OpenAPI document.

## Where state lives

| Concern | Mechanism |
|---|---|
| Auth tokens | **httpOnly cookies on the FE domain** (`tuition_access`, `tuition_refresh`). Never in JS, localStorage, or a non-httpOnly cookie. |
| Session / user | TanStack Query (`useAuth` → `GET /api/auth/me`). |
| Server data (cases, tutors, docs) | TanStack Query hooks (`useCases`, `useCase`, `useDirectory`, …) keyed by query params. |
| Form state | React Hook Form + zod resolver (`caseFormSchema`, `profileFormSchema`). |
| UI-only state (search box, page, filters) | local `useState`. |

There is no global client store (Redux/Zustand); server state is owned by TanStack
Query and UI state is local to each page.

## The BFF (Backend-For-Frontend) layer

All browser → backend traffic goes through Next route handlers under
`src/app/api/`. The browser never holds a bearer token.

- `src/lib/auth-server.ts` — server-only cookie + `backendFetch` helpers.
  `BACKEND_URL` is the server-side base (`http://backend:3001` on the compose
  network); `NEXT_PUBLIC_API_URL` is only for browser-facing display.
- `api/auth/{login,refresh,logout,me}` — set/clear httpOnly cookies; `me` performs
  a **silent refresh** (rotate once on 401, then retry).
- `api/proxy/[...path]` — authenticated reverse proxy for all data endpoints:
  attaches the access cookie as `Authorization: Bearer`, silently refreshes on 401,
  and passes 3xx redirects (e.g. document download → presigned URL) straight through.

## Component / route map

```
src/
├── app/
│   ├── layout.tsx                 # QueryProvider + DashboardShell (sidebar → mobile drawer)
│   ├── page.tsx                   # dashboard home
│   ├── login/page.tsx             # email/password sign-in
│   ├── cases/
│   │   ├── page.tsx               # list: search + status filter + pagination
│   │   ├── new/page.tsx           # create (CaseForm)
│   │   └── [id]/
│   │       ├── page.tsx           # detail: docs, upload, invite/revoke (owner)
│   │       └── edit/page.tsx      # edit (CaseForm)
│   ├── tutors/
│   │   ├── page.tsx               # directory (parents only)
│   │   └── [id]/page.tsx          # profile detail
│   ├── profile/page.tsx           # tutor: edit own profile + upload docs
│   └── api/                       # BFF (auth + proxy) — server only
├── components/
│   ├── dashboard-shell.tsx        # responsive nav
│   ├── case-form.tsx              # RHF + zod, shared by new/edit
│   ├── states.tsx                 # LoadingState / EmptyState / ErrorState(retry)
│   └── ui/                        # shadcn primitives (Button, Sheet)
└── lib/
    ├── api.ts                     # typed client over /api/proxy (casesApi, tutorsApi, uploadDocument)
    ├── api-types.ts               # hand-maintained contract types
    ├── api-types.gen.ts           # generated from OpenAPI (pnpm gen:types)
    ├── schemas.ts                 # zod form schemas
    ├── use-auth.ts / use-cases.ts / use-tutors.ts  # TanStack Query hooks
    └── auth-server.ts             # BFF cookie + fetch helpers (server only)
```

## UX conventions

Every data-bound screen renders **loading → empty → error(retry)** via the shared
`states.tsx` components. Permission-aware UI is driven by `useAuth().user.role`:

- Parents: "New case" button, tutor directory, invite/revoke controls.
- Tutors: own profile editor; directory shows a parents-only notice.

403/404 from the API surface as a friendly "unavailable — may not exist or you may
not have access" state rather than a crash or blank page.

## Contract types

`pnpm gen:types` (frontend) runs `openapi-typescript` against the running backend's
`/docs-json` and writes `src/lib/api-types.gen.ts`. The hand-maintained
`api-types.ts` holds the stable domain shapes used across the app.
