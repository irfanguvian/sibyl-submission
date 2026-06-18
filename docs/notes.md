# Execution Notes — for review

Per-phase notes from execution of `plan.md`. Each phase: what was built/changed, verification gate results, and anything deferred. Review and approve before the next phase starts.

---

## ⚠️ Architecture change (your new constraint, applied)

You asked to **drop the monorepo + shared package** and instead ship **two fully
standalone services**. This is now the architecture of record (see `plan.md` →
"Architecture constraint"):

- **Parent folder holds only** `docs/`, `.devcontainer/`, and `docker-compose.yml`
  (+ repo meta: `README.md`, `.gitignore`, `.editorconfig`, `.env.example`).
- **No** root `package.json`, `pnpm-workspace.yaml`, root `biome.json`,
  `tsconfig.base.json`, or `packages/`.
- `backend/` (was `apps/api`) and `frontend/` (was `apps/web`) are independent
  pnpm projects — each with its **own** `package.json`, `pnpm-lock.yaml`,
  `node_modules`, `biome.json`, and `tsconfig.json`.
- **Flow:** frontend hits backend over HTTP (Next BFF proxy `/api/*` → NestJS).
- **Contract types:** frontend no longer imports shared zod. It generates types
  from the backend OpenAPI doc (`pnpm gen:types` → `frontend/src/lib/api-types.gen.ts`,
  via `openapi-typescript`). Stable primitives (Role, pagination envelope) live in
  `frontend/src/lib/api-types.ts`.
- **Biome per service only** — one `biome.json` in `backend/`, one in `frontend/`.

---

## Phase 1 — Scaffold + standalone restructure ✅ (gate green, pending your review)

### What changed from the previous (monorepo) Phase 1

| Before (monorepo) | After (standalone) |
|---|---|
| `apps/api` | `backend/` |
| `apps/web` | `frontend/` |
| `packages/shared` (zod) | **deleted** — frontend uses local + OpenAPI-generated types |
| root `package.json` + `pnpm-workspace.yaml` | **deleted** |
| root `biome.json` (with `apps/api` override) | **deleted** — replaced by per-service `biome.json` |
| `tsconfig.base.json` (extended by both) | **deleted** — each `tsconfig.json` now self-contained |
| root `pnpm-lock.yaml` / `node_modules` | **deleted** — per-service lockfiles |
| `@tuition/shared` dependency in api + web | **removed** |

### Per-service config now

- **`backend/biome.json`** — keeps `style/useImportType: off` (NestJS DI needs
  runtime class references; biome's safe-fix would otherwise convert injected
  imports to `import type` and break DI). Ignores `.omc`, `dist`, `node_modules`,
  `coverage`, `prisma/migrations`.
- **`frontend/biome.json`** — recommended ruleset; ignores `.next`, `node_modules`,
  `next-env.d.ts`, the generated `api-types.gen.ts`, `.omc`.
- Self-contained `tsconfig.json` in each (no `extends`, no `@tuition/shared` paths).
- `frontend/src/lib/api.ts` now imports from `./api-types` instead of `@tuition/shared`.
- `frontend` adds `openapi-typescript` devDep + `gen:types` script.

### Docker / compose / devcontainer

- Each service now builds from **its own context** (`./backend`, `./frontend`) with
  a **standalone** multi-stage Dockerfile (no workspace `pnpm deploy`; backend uses
  a pruned `--prod` deps stage + copies generated Prisma client; frontend uses Next
  `output: standalone`).
- `docker-compose.yml`: services renamed `api`→`backend`, `web`→`frontend`;
  `NEXT_PUBLIC_API_URL` defaults to `http://backend:3001` on the compose network.
- `.devcontainer/devcontainer.json`: `service: backend`; `postCreateCommand` now
  installs **both** services (`backend` then `frontend`) via corepack pnpm.
- Per-service `.dockerignore` added; root `.dockerignore` removed.

### Gate results (local, no Docker needed)

| Check | backend | frontend |
|-------|---------|----------|
| `pnpm install` | ✅ | ✅ |
| `pnpm lint` (biome) | ✅ clean (15 files) | ✅ clean (20 files) |
| `pnpm test` (unit) | ✅ 2/2 | ✅ 5/5 |
| `pnpm test:e2e` | ✅ 1/1 (health) | n/a |
| `pnpm build` | ✅ (`dist/main.js`) | ✅ (3 routes prerendered, standalone output) |

Sanity checks: no `@tuition/*` reference remains anywhere; no forbidden root files
(`package.json`, `pnpm-workspace.yaml`, root `biome.json`, `tsconfig.base.json`,
`packages/`, `apps/`).

### Bugs found + fixed during the gate

1. **e2e was never actually green before.** The prior monorepo gate ran only
   `pnpm -r test` (unit), so `test/health.e2e.spec.ts` was never exercised. Run
   standalone, it failed: `ConfigModule.forRoot` validates env at import and there
   was no `DATABASE_URL`/`JWT_SECRET`. Fixed by adding test-only env defaults in
   `backend/vitest.e2e.config.ts` (health e2e touches no DB).
2. **biome linted OMC state.** OMC writes `.omc/state/` relative to cwd, so a
   `backend/.omc/` appeared and biome flagged it. Added `.omc` to both services'
   `biome.json` ignore list (the old root biome had this; per-service ones didn't).

### Decision still open from the original Phase 1 (carried forward)

- List query param is `?pageSize=` (not `?limit=`). Confirm this is the contract you
  want before Phase 3 builds the real list endpoints.

### Deferred / NOT verified (need your environment)

- **Docker daemon is DOWN on this machine** (`docker info` fails). Could not run
  `docker compose up`, build images (size targets backend < 400 MB / frontend < 300 MB
  unproven), render live Swagger, or run `prisma migrate dev`. Dockerfiles + compose
  are rewritten and config-correct but **unproven at runtime.**
- Git: changes are **not committed** (I commit only when you ask).

### Suggested check before approving Phase 2

```bash
# with Docker Desktop running:
cp .env.example .env
docker compose up -d db db_test minio minio-bootstrap
cd backend && pnpm exec prisma migrate dev --name init
docker compose up backend frontend   # confirm :3001/health, :3001/docs, :3000 shell
```

---

## 🚧 Phases 2–7 — BLOCKED on a live database (need your input)

Phases 2–5 acceptance criteria are **database-backed e2e** that cannot be
verified here because **Docker (Postgres) is down**:

- **Phase 2 (Auth):** login / wrong-pw 401 / expired-access 401 / refresh rotation /
  revoked-refresh-reuse kills family / logout-immediate-401 — all require a real DB
  (tokens are DB-persisted per D3).
- **Phase 3 (Cases/ACL):** the whole ACL matrix (404/403 semantics) is e2e against DB.
- **Phase 4 (Documents):** upload/download + MinIO + authz re-check.
- **Phase 5 (Tutor profiles/directory):** ACL + directory e2e.

I can write the **code + unit tests (mocked Prisma)** for these without a DB, but I
**cannot satisfy their e2e acceptance gates** until Postgres is up. Building 6 phases
of unverifiable backend would be exactly the "looks done" trap this process avoids.

**You chose: code-only, defer e2e.** I build phases 2–7 with unit tests; DB-backed
e2e gates are deferred for you to run once Postgres is up. Each phase still passes
lint + unit + build locally.

---

## Phase 2 — Auth & Users ✅ (code + unit green, e2e deferred)

### Backend (`backend/`)

- **Prisma:** added `Role` enum, expanded `User` (passwordHash, role, timestamps),
  `oauth_access_token`, `oauth_refresh_token` (per D3). Client generated; **migration
  deferred** (needs DB).
- **`PrismaModule`/`PrismaService`** (global), connects on boot.
- **Auth module** (`src/auth/`):
  - `TokenService` — issue/verify/rotate/revoke. Access = signed JWT whose `jti`
    hash is stored in `oauth_access_token`; every request re-checks that row
    (server-side revocation). Refresh = opaque random, sha256-hashed in DB.
    **Rotation** revokes the old pair; **reuse of a revoked refresh token revokes
    the whole family** (all of a user's tokens).
  - `AuthService` — bcrypt verify, generic "Invalid credentials" (no user-enumeration).
  - `AuthController` — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
    (guarded), `GET /auth/me` (guarded). Swagger: `@ApiOkResponse`/`@ApiUnauthorizedResponse`.
  - `JwtAuthGuard` (bearer + DB check, `@Public()` opt-out), `RolesGuard` + `@Roles()`,
    `@CurrentUser()` param decorator.
- **Seed** (`prisma/seed.ts`, `pnpm db:seed`): `parent@example.com`, `tutor1@example.com`,
  `tutor2@example.com` — all password `password123`.
- **Unit tests (21 total):** token service (issue/verify/rotate/family-revoke/logout edge
  cases — 11), JwtAuthGuard (4), RolesGuard (4), health (2).

### Frontend (`frontend/`) — BFF, tokens never touch JS

- **BFF route handlers** `/api/auth/{login,refresh,logout,me}` (`src/app/api/auth/*`):
  tokens stored as **httpOnly, SameSite=Lax, Secure-in-prod cookies on the FE domain
  only**; the backend never sets cookies. `me` does **silent refresh**: on a 401 it
  rotates once via the refresh cookie and retries before failing.
- `src/lib/auth-server.ts` — server-only cookie + backend-fetch helpers
  (`BACKEND_URL` env: `http://backend:3001` on the compose network).
- `src/lib/use-auth.ts` — TanStack Query `useAuth()` (session via `/api/auth/me`,
  login/logout mutations).
- `src/app/login/page.tsx` — login form with pending + error states.
- **Tests (3 new):** login renders, posts + redirects on success, shows error on 401.

### Gate

| Check | backend | frontend |
|-------|---------|----------|
| lint | ✅ (34 files) | ✅ (28 files) |
| unit test | ✅ 21/21 | ✅ 8/8 |
| build | ✅ | ✅ (BFF routes + /login) |

biome fix: backend needed `javascript.parser.unsafeParameterDecoratorsEnabled: true`
for NestJS `@Body()`/`@CurrentUser()` parameter decorators (biome rejects them otherwise).

### Deferred (need DB)

- `prisma migrate dev` to create the auth tables.
- Auth **e2e** (login ok / wrong-pw 401 / expired 401 / refresh rotation /
  revoked-reuse kills family / logout-immediate-401) — logic is unit-tested with a
  mocked Prisma, but the full HTTP+DB e2e is not run here.

---

## Phase 3 — Cases & Invites + core ACL ✅ (code + unit green, e2e deferred)

Backend only (frontend case flows are Phase 6).

- **Prisma:** `CaseStatus` enum (OPEN/MATCHED/CLOSED), `case` (title, subject, level,
  location, budgetPerHour:Int, status, ownerId, timestamps), `case_invite`
  (`@@unique([caseId, tutorId])`). Client regenerated; migration deferred.
- **`CaseAccessService`** — the single ACL choke point (D8):
  - PARENT sees only owned cases; TUTOR sees only invited cases.
  - Not-visible → **404** (no existence leak). Visible-but-not-owner (invited tutor
    editing) → **403**. `getViewableCase` / `getEditableCase`.
- **`CasesService` / `CasesController`** (`@UseGuards(JwtAuthGuard, RolesGuard)`):
  - `POST /cases` (`@Roles(PARENT)`), `GET /cases/:id`, `PATCH /cases/:id` (owner;
    whitelisted fields via `UpdateCaseDto`), `GET /cases` (pagination + `q` title
    search + subject/level/status filters, role-scoped).
  - `POST /cases/:id/invites` (idempotent upsert; rejects non-tutor 400 / unknown 404),
    `DELETE /cases/:id/invites/:tutorId` (404 if no invite). All owner-gated.
  - Out-of-range page → empty `data` + honest meta; invalid `status` filter → 400 (enum).
- **Unit tests (+15):** CaseAccessService ACL matrix (8), CasesService list-scoping +
  invite validation + pagination edges (7).

### Gate: backend lint ✅ (46 files) · unit ✅ 36/36 · build ✅

### Deferred (need DB): migration; ACL e2e matrix (parent-other 404, tutor-uninvited
404, tutor-revoked 404, invited-tutor-edit 403), pagination/search/filter e2e.

---

## Phase 4 — Documents ✅ (code + unit green, e2e deferred)

Backend only.

- **Deps:** `@aws-sdk/client-s3` + `s3-request-presigner` (MinIO is S3-compatible),
  `@types/multer`. Env: `S3_*`, `MAX_UPLOAD_BYTES`.
- **Prisma:** `document` (originalName, storedKey UUID `@unique`, size, mime,
  uploadedById, caseId?, tutorProfileId?).
- **`StorageService`** (global) — `put(key, buf, mime)`, `presignedGetUrl(key, 60s)`.
- **`src/documents/mime.ts`** — **magic-byte** sniff (PDF/PNG/JPEG/DOCX-zip);
  rejects anything else (e.g. MZ exe) → 415. `safeFilename` strips path components
  + control/forbidden chars (preserves dots/digits).
- **`DocumentsService` / `DocumentsController`:**
  - `POST /cases/:caseId/documents` (FileInterceptor, 10 MB limit) — viewable-case
    gate; 413 oversized; 415 bad type; stores under UUID key; original name in DB only.
  - `GET /cases/:caseId/documents`; `GET /documents/:id/download` → **302 to a 60s
    presigned URL** after an authz re-check (uninvited → 404).
  - Response DTO **never exposes `storedKey`** / filesystem paths.
- **Unit tests (+20):** mime sniff allow/deny + filename safety (12), documents service
  authz + size/mime + download re-check (8).

## Phase 5 — Tutor Profiles & Directory ✅ (code + unit green, e2e deferred)

Backend only.

- **Prisma:** `tutor_profile` (userId `@unique`, displayName, qualifications[],
  experiences[]); wired `document.tutorProfileId` relation.
- **`TutorProfilesService` / controller** (`/tutor-profiles`):
  - `PUT /me` + `GET /me` (tutor upsert/get own); `GET /` directory
    (`@Roles(PARENT)`, pagination + name search); `GET /:id` (parent any, tutor own
    only — **D9 hides other tutors as 404**).
  - Profile docs (reuse Phase 4): `POST /me/documents`, `GET /:id/documents`
    (parent any / tutor own), `DELETE /me/documents/:docId`.
  - `DocumentsService` refactored: shared `validateAndStore`; download authz now
    covers profile docs (parent any / owner tutor).
- Route order: `/me*` declared before `/:id` so they resolve correctly.
- **Unit tests (+6):** profile upsert/get/D9-view/directory-search.

### Gate (phases 4 & 5): backend lint ✅ (62 files) · unit ✅ 62/62 · build ✅

### Deferred (need DB + MinIO): migrations; document upload/download e2e (parent +
invited tutor ok, uninvited 404, oversized 413, spoofed-ext 415, no-key-in-body);
profile/directory ACL e2e.

---

## Phase 6 — Frontend Flows ✅ (code + component tests green, live click-through deferred)

- **Authenticated BFF proxy** `src/app/api/proxy/[...path]` — forwards all data calls
  to the backend with the access cookie as bearer; silent-refreshes on 401; passes
  302 download redirects (presigned URLs) through. JSON + multipart bodies supported.
- **Typed client** `src/lib/api.ts` (`casesApi`, `tutorsApi`, `uploadDocument`) +
  `use-cases` / `use-tutors` TanStack Query hooks. zod form schemas in `schemas.ts`.
- **Shared states** `components/states.tsx` (Loading / Empty / Error+retry) used on
  every data screen. **`CaseForm`** = RHF + zod resolver, shared by new/edit.
- **Pages:** cases list (search + status filter + pagination), case new/edit,
  case detail (documents + upload + invite/revoke, owner-only controls), tutor
  directory (parents-only), tutor profile detail, tutor profile editor + doc upload.
- **Permission-aware UI** via `useAuth().user.role`; 403/404 render a friendly
  "unavailable" state.
- **Tests (+3):** `CaseForm` renders / blocks invalid submit / submits parsed values.
  Existing login (3) + shell (5) still green → 11 FE tests.

## Phase 7 — Hardening, Tests, Docs ✅ (code + docs green, CI-in-Docker deferred)

- **Backend hardening:** `helmet()`, CORS allowlist from `CORS_ORIGINS`, global
  rate limit (100/min/IP) + tight **login limit 5/min/IP** via `@nestjs/throttler`.
- **Swagger:** every endpoint annotated (operations, response DTOs, auth, error codes).
- **Docs:** `docs/frontend.md` (architecture, where state lives, BFF, component map);
  README **D3 auth** + **D4 storage** tradeoffs written.

### Gate (final): backend lint ✅ · unit ✅ 62/62 · e2e(health) ✅ · build ✅ ·
### frontend lint ✅ · unit ✅ 11/11 · build ✅

---

## ⚠️ Outstanding for you (the deferred set)

Everything below was **intentionally deferred** under your "code-only" decision and
needs a live environment to finish/verify:

1. **Start Docker**, then in `backend/`: `pnpm exec prisma migrate dev --name init`
   and `pnpm db:seed` (creates demo users). MinIO bucket is created by compose.
2. **DB-backed e2e** — write/run the e2e suites the unit tests stand in for:
   auth (login/refresh-rotation/revoked-reuse-family/logout), cases ACL matrix
   (404/403), documents (upload/download/413/415/no-key-in-body), profiles/directory.
3. **Live click-through** of the frontend flows + responsive check (375/768/1280).
4. **Image size check** (backend < 400 MB, frontend < 300 MB) once Docker builds.
5. **Commit** — nothing has been committed (I commit only on request).
6. **Phase 8 (Deployment)** was out of scope for "until phase 7".

A full architect/critic review pass + the mandatory deslop pass were **not** run as
a cloud/agent step (kept inline to respect the no-spawn default); the code is biome-
clean and unit-gated throughout, but a fresh-eyes review before deploy is advisable.
