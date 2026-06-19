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
│   ├── page.tsx                   # public welcome/landing — CTA → login/signup; redirects authed users to /cases
│   ├── login/page.tsx             # email/password sign-in
│   ├── signup/page.tsx            # self-registration: email, password, role select, displayName (TUTOR only)
│   ├── cases/
│   │   ├── page.tsx               # list: search + status filter + pagination (cases-centric home for parents)
│   │   ├── new/page.tsx           # create (CaseForm — now includes description textarea)
│   │   └── [id]/
│   │       ├── page.tsx           # detail: brief, docs grouped by uploader, invite panel (owner), recommendations
│   │       └── edit/page.tsx      # edit (CaseForm)
│   ├── tutors/
│   │   ├── page.tsx               # directory (parents only)
│   │   └── [id]/page.tsx          # profile detail (qualifications, experiences, profile docs)
│   ├── profile/page.tsx           # tutor: edit own profile + upload/delete own profile docs
│   └── api/                       # BFF (auth + proxy) — server only
│       └── auth/register/         # BFF route for POST /auth/register
├── components/
│   ├── dashboard-shell.tsx        # responsive nav; parent nav has no "Dashboard" link (cases-centric);
│   │                              #   tutor "Cases" nav labelled "Invitations"
│   ├── case-form.tsx              # RHF + zod, shared by new/edit; gained description textarea
│   ├── invite-tutor/              # directory name-search → invite by id; invited-tutors list with
│   │                              #   Accept / Revoke buttons; matched-tutor badge (owner-only)
│   ├── recommendation-panel/      # AI-mock "Suggested tutors" panel on case detail; loading/empty/error states
│   ├── case-documents/            # document list grouped by uploader (parent vs tutor); per-doc download/delete;
│   │                              #   multi-file drag-drop upload via file-dropzone (multi mode)
│   ├── file-dropzone.tsx          # drag-drop upload widget; gained multi-file mode (loops single-upload endpoint)
│   ├── states.tsx                 # LoadingState / EmptyState / ErrorState(retry)
│   └── ui/                        # shadcn primitives (Button, Sheet, …)
└── lib/
    ├── api.ts                     # typed client over /api/proxy (casesApi, tutorsApi, uploadDocument, …)
    ├── api-types.ts               # hand-maintained contract types
    ├── api-types.gen.ts           # generated from OpenAPI (pnpm gen:types)
    ├── schemas.ts                 # zod form schemas (caseFormSchema gained description; signupSchema added)
    ├── use-auth.ts                # useAuth hook + register mutation (POST /auth/register)
    ├── use-cases.ts               # useCases, useCase, useCreateCase, useUpdateCase
    ├── use-case-invites.ts        # useCaseInvites — GET /cases/:id/invites
    ├── useAcceptTutor.ts          # useAcceptTutor — POST /cases/:id/accept
    ├── useRecommendations.ts      # useRecommendations — GET /cases/:id/recommendations
    ├── useDeleteCaseDocument.ts   # useDeleteCaseDocument — DELETE /cases/:caseId/documents/:id (soft-delete)
    ├── useDeleteOwnDocument.ts    # useDeleteOwnDocument — DELETE /tutor-profiles/me/documents/:id (soft-delete)
    ├── use-tutors.ts              # useDirectory, useTutorProfile
    └── auth-server.ts             # BFF cookie + fetch helpers (server only)
```

## New pages (Phase 9)

### `/` — Welcome / landing
Public page rendered before login. Shows the platform pitch and two CTAs: "Log in" and "Sign up". Authenticated users are redirected immediately to `/cases` (no flash). No sidebar chrome at this route.

### `/signup` — Self-registration
RHF + zod form with fields: email, password, role select (PARENT / TUTOR), and displayName (conditionally required when TUTOR is selected). Submits to the BFF route `POST /api/auth/register` → backend `POST /auth/register`. On success, redirects to `/login`. Duplicate email shows an inline 409 error. Invalid role shows a 400 error.

## New / updated components (Phase 9)

### `invite-tutor/`
Renders on the case detail page for the case owner (PARENT). Contains:
- A name-search input that queries the tutor directory and shows results with `displayName + qualifications`.
- An invite button per result that sends `POST /cases/:id/invites { tutorId }`.
- An invited-tutors list (from `GET /cases/:id/invites`) showing each invited tutor's name and qualifications, with per-row **Accept** (`POST /cases/:id/accept`) and **Revoke** (`DELETE /cases/:id/invites/:tutorId`) buttons.
- A matched-tutor badge when `case.status === MATCHED`, identifying the accepted tutor. The Accept button is disabled for all other tutors once matched (409 guard).

### `recommendation-panel/`
Renders on the case detail page for the case owner. Calls `GET /cases/:id/recommendations` and displays a ranked list of suggested tutors (name, qualifications, match score). Shows a skeleton during load, an empty state when no tutors match, and an error state with retry. Labelled "AI-suggested (mock)" in the UI to be transparent about the heuristic nature.

### `case-documents/`
Replaces the flat document list on case detail. Groups documents by uploader role (parent-uploaded / tutor-uploaded sections). Each document row has a **Download** link and a **Delete** button (visible only to the uploader). Delete performs a soft-delete (`DELETE /cases/:caseId/documents/:id`); the document disappears from the list immediately via TanStack Query invalidation. Upload uses `file-dropzone` in multi-file mode.

### `file-dropzone` (updated)
Gained a `multiple` prop. In multi-file mode the component accepts a list of dropped or selected files and loops the existing single-upload endpoint once per file, reporting per-file progress and errors. 413/415 errors are shown inline per file.

### `case-form` (updated)
Gained a `description` textarea field (optional). Value round-trips through the create/update flow and appears in the case detail "Brief" section.

## UX conventions

Every data-bound screen renders **loading → empty → error(retry)** via the shared
`states.tsx` components. Permission-aware UI is driven by `useAuth().user.role`:

- Parents: "New case" button, tutor directory, invite/revoke/accept controls, recommendations panel. Nav is cases-centric (no "Dashboard" link).
- Tutors: own profile editor; "Cases" nav link labelled "Invitations" to reflect invite-only model; directory shows a parents-only notice.

403/404 from the API surface as a friendly "unavailable — may not exist or you may
not have access" state rather than a crash or blank page.

## Contract types

`pnpm gen:types` (frontend) runs `openapi-typescript` against the running backend's
`/docs-json` and writes `src/lib/api-types.gen.ts`. The hand-maintained
`api-types.ts` holds the stable domain shapes used across the app.
