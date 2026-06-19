# Phased Work Plan

**Status:** pending approval — no code written yet.
**Source requirement:** `docs/requirement.md` · **Decisions:** `docs/decision.md` · **Progress:** `docs/checkpoint.md` · **Notes:** `docs/research.md`

---

## Requirements Summary

- Tuition marketplace: **parents** post cases, **tutors** get invited and respond.
- Roles: Parent, Tutor. Login/logout, `GET /auth/me`, token-expiry behavior.
- **Cases:** title, subject, level, location, budgetPerHour, status (`open|matched|closed`), owner, timestamps. Create/view/edit + list with pagination, keyword search, subject/level/status filters. Edge cases: empty results, out-of-range pages, partial fields.
- **Access control:** parent → own cases only; tutor → invited cases only; parent invites/revokes tutors. 401/403/404 semantics (404 for existence-leak cases, see D8).
- **Documents:** belong to a case or tutor profile. Upload/list/download, server-side authz re-check on download, allowlist pdf/docx/png/jpg, max size 10 MB, safe filenames, no path traversal, no filesystem paths in responses.
- **Tutor profiles + directory:** tutor edits own profile + uploads supporting docs; parents browse paginated/searchable directory and view any profile.
- **Deliverables:** deployed app, Swagger URL, FE docs, seeded demo credentials, 5–10 min video.

## Stack (fixed constraints)

NestJS (Express adapter) + Prisma + Swagger + Biome · Next.js App Router + TS + Tailwind v4 + shadcn/ui · Vitest (unit + e2e) · Docker + devcontainer for all environments · JWT auth with DB-persisted tokens (D3) · pnpm (per service) · PostgreSQL.

### Architecture constraint (overrides original monorepo design)

**Two standalone services, no shared package.** The repo is NOT a pnpm workspace.

- `backend/` and `frontend/` are independent projects — each has its own `package.json`, `pnpm-lock.yaml`, `node_modules`, `biome.json`, and `tsconfig.json`. There is **no** root `package.json`, `pnpm-workspace.yaml`, root `biome.json`, `tsconfig.base.json`, or `packages/shared`.
- The repo **root holds only** `docs/`, `.devcontainer/`, and `docker-compose.yml` (plus repo meta: README, `.gitignore`, `.editorconfig`, `.env.example`).
- **Flow:** frontend hits backend over HTTP (Next BFF proxy `/api/*` → NestJS).
- **Contract types:** the frontend does not import shared zod schemas. It generates TS types from the backend's OpenAPI document via `openapi-typescript` (`pnpm gen:types` → `frontend/src/lib/api-types.gen.ts`). Cross-cutting primitives (Role, pagination envelope) live in `frontend/src/lib/api-types.ts`.
- Phases 2–7 below still reference "`packages/shared`" in places written before this constraint — read those as: backend defines its own DTOs/zod; frontend defines its own local zod schemas / uses generated OpenAPI types. There is no cross-service import.

---

## Phase 1 — Scaffold

### Scope (standalone-service architecture)

1. **Repo root (docs + dev-container only):** `docker-compose.yml`, `.devcontainer/`, `docs/`, README, `.editorconfig`, `.gitignore`, `.env.example`, git init. **No** root `package.json`, `pnpm-workspace.yaml`, root `biome.json`, `tsconfig.base.json`, or `packages/`.
2. **`backend/`** (NestJS, Express adapter — own pnpm project + `biome.json` + `tsconfig.json`):
   - Nest CLI scaffold, strict TS
   - Prisma init (Postgres datasource, placeholder `User` model to prove migrate works)
   - `@nestjs/swagger`: Swagger UI at `/docs`, OpenAPI JSON at `/docs-json` (the contract source for the frontend)
   - `@nestjs/config` with zod-validated env schema
   - Global `ValidationPipe` + global exception filter (no stack traces to clients)
   - `GET /health`
   - Vitest (`@swc/core` plugin for decorators): 1 sample unit test + 1 supertest e2e (`test/health.e2e.spec.ts`)
   - `biome.json` disables `style/useImportType` (NestJS DI needs runtime class refs)
3. **`frontend/`** (Next.js App Router — own pnpm project + `biome.json` + `tsconfig.json`):
   - TS, Tailwind v4, `src/` dir, `output: "standalone"`
   - shadcn/ui init + responsive dashboard shell (sidebar → mobile drawer)
   - TanStack Query provider + typed API client stub (`src/lib/api.ts`)
   - Local contract types in `src/lib/api-types.ts`; `gen:types` script (`openapi-typescript`) writes `src/lib/api-types.gen.ts` from the backend OpenAPI doc. **No shared-package import.**
   - Vitest + Testing Library + jsdom: 1 component test
4. **Docker:** per-service standalone multi-stage Dockerfiles (D7); `docker-compose.yml` with `db` (postgres:17-alpine, healthcheck, volume), `db_test`, `minio` (+ bucket bootstrap), `backend`, `frontend`. Each service builds from its own context (`./backend`, `./frontend`).
5. **`.devcontainer/`:** compose-based, pnpm via corepack; `postCreateCommand` installs both services; extensions: Biome, Prisma, Tailwind.
6. **Docs:** README (setup, scripts, architecture, links to `docs/`).

### Acceptance criteria

- `cd backend && pnpm install && pnpm lint && pnpm test && pnpm build` all pass
- `cd frontend && pnpm install && pnpm lint && pnpm test && pnpm build` all pass
- No `@tuition/shared` import anywhere; no root `package.json` / workspace / root biome
- `docker compose up` → db + minio + backend + frontend all healthy (Docker-runtime, deferred to user env)
- `GET localhost:3001/health` → 200; `localhost:3001/docs` renders Swagger UI
- `localhost:3000` renders responsive dashboard shell (sidebar collapses < 768 px)
- `cd backend && pnpm exec prisma migrate dev` runs against compose db (Docker-runtime, deferred)
- Repo opens in devcontainer; tests pass inside it
- Runner images: frontend < 300 MB, backend < 400 MB (deferred)

---

## Phase 2 — Auth & Users (per D3)

### Scope

- Prisma models: `User` (email unique, passwordHash, role enum `PARENT|TUTOR`), `OauthAccessToken` → table `oauth_access_token`, `OauthRefreshToken` → table `oauth_refresh_token`:

```prisma
model OauthAccessToken {
  id           String             @id @default(uuid())
  userId       String
  tokenHash    String             @unique // sha256(jti)
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime           @default(now())
  user         User               @relation(fields: [userId], references: [id])
  refreshToken OauthRefreshToken?

  @@index([userId])
  @@map("oauth_access_token")
}

model OauthRefreshToken {
  id            String           @id @default(uuid())
  accessTokenId String           @unique
  tokenHash     String           @unique
  expiresAt     DateTime
  revokedAt     DateTime?
  createdAt     DateTime         @default(now())
  accessToken   OauthAccessToken @relation(fields: [accessTokenId], references: [id])

  @@map("oauth_refresh_token")
}
```

- API endpoints: `POST /auth/login`, `POST /auth/logout` (revokes pair), `POST /auth/refresh` (rotation; reuse of revoked refresh → revoke user's token family), `GET /auth/me`
- bcrypt hashing; JWT guard: verify signature + exp → DB lookup `oauth_access_token` by token hash → reject if missing/revoked
- `@Roles()` decorator + guard
- Seed script: 1 parent + 2 tutors, documented demo credentials
- **FE BFF layer:** Next route handlers `/api/auth/*` + API proxy; tokens stored as httpOnly Secure cookies **on FE domain only**; proxy forwards `Authorization: Bearer`; 401 → silent refresh → retry once → redirect to login
- FE login page; auth state via TanStack Query on `/auth/me`

### Acceptance criteria

- E2E: login ok / wrong password 401 / expired access 401 / refresh rotation works / revoked-refresh reuse kills family / logout revokes immediately (subsequent request 401)
- Unit: guard logic, token service (issue/rotate/revoke)
- No token ever in localStorage or non-httpOnly cookie; API never sets cookies
- Swagger documents all auth endpoints incl. 401 responses

---

## Phase 3 — Cases & Invites (core ACL)

### Scope

- Prisma: `Case` (fields per requirement §B), `CaseInvite` (caseId + tutorId unique pair, timestamps)
- Endpoints: create (parent), get by id, patch (parent owner; editable fields whitelisted), list with pagination + keyword search (title) + filters (subject/level/status); `POST /cases/:id/invites`, `DELETE /cases/:id/invites/:tutorId` (parent owner)
- `CaseAccessService` — single choke point: parent = owner only; tutor = invited only; uninvited/foreign → **404** (D8); invited tutor editing → 403
- Edge cases: empty results + out-of-range page → empty `data` with correct meta; invalid filter values → 400

### Acceptance criteria

- ACL matrix covered by named e2e tests: parent-other-case 404, tutor-uninvited 404, tutor-revoked 404 after revoke, tutor-invited can view not edit (403 on edit)
- Pagination/search/filter e2e incl. out-of-range page
- Swagger complete for all case endpoints

---

## Phase 4 — Documents

### Scope

- Prisma: `Document` (originalName, storedKey UUID, size, mime, uploadedBy, polymorphic owner: caseId? / tutorProfileId?)
- Upload: multipart stream → magic-byte MIME sniff (not extension trust) → allowlist pdf/docx/png/jpg → 10 MB cap → stream to MinIO/R2 under UUID key; original filename only in DB
- List documents per case (authorized users)
- Download: authz re-check via `CaseAccessService` → 302 to 60 s presigned URL
- Errors: 415 unsupported type, 413 too large, clean messages

### Acceptance criteria

- E2E: upload+download as parent and invited tutor; uninvited tutor download → 404; oversized 413; spoofed extension (exe renamed .pdf) 415; path-traversal filename stored safely
- E2E asserts no storage key / filesystem path appears in any API response body
- Swagger: multipart upload + error codes documented

---

## Phase 5 — Tutor Profiles & Directory

### Scope

- Prisma: `TutorProfile` (displayName, qualifications[], experiences[], userId unique) + profile documents (reuse Phase 4 mechanism)
- Endpoints: tutor create/edit own profile; tutor upload/delete own profile docs; parent-only directory list (pagination + name/keyword search); parent view any profile detail
- Tutors cannot view other tutors' profiles (D9)

### Acceptance criteria

- ACL e2e: tutor edits other profile → 403/404 per D8 logic; tutor lists directory → 403; parent reads any profile → 200
- Directory pagination + search e2e

---

## Phase 6 — Frontend Flows

### Scope

- **Parent:** case list (search/filter/pagination) → case detail (docs, invited tutors, invite/revoke) → create/edit case → tutor directory → tutor profile detail
- **Tutor:** profile editor + doc upload → invited-cases list → case detail (view + upload)
- Forms: React Hook Form + zod resolvers from `packages/shared`
- Every screen: loading skeleton, empty state, error state with retry; 401/403 → friendly page (no crash/blank)
- Permission-aware UI: hide/disable actions per role
- Document upload with progress + clear failure messages; download via proxy route

### Acceptance criteria

- Full demo script (requirement video section) click-through-able locally: tutor sets up profile + doc → parent browses directory, creates case, invites tutor, uploads doc → tutor views case
- Responsive at 375 / 768 / 1280 px, no broken layouts
- Forced 401/403/500 responses render friendly states (verified with component tests)

---

## Phase 7 — Hardening, Tests, Docs

### Scope

- Coverage pass: ACL matrix, upload abuse, pagination edges
- Helmet, CORS allowlist, rate limit `/auth/login`
- Swagger completeness pass: every endpoint has DTOs, response codes, auth annotations
- `docs/frontend.md`: FE architecture, where state lives, component map (satisfies FE-doc requirement)
- TSDoc on auth, access-control, upload, API-client modules

### Acceptance criteria

- `pnpm -r test` green inside Docker (CI-like run)
- Swagger JSON passes validation; spot-check 5 endpoints vs actual behavior
- README explains auth choice + tradeoffs (D3) and storage design (D4)

---

## Phase 8 — Deployment & Submission Prep

### Scope

- Neon DB + `prisma migrate deploy`; R2 bucket + credentials; API → Render (Dockerfile); FE → Vercel (env: API base URL)
- Cookie domain is FE-only (D3) — no cross-site cookie work needed; verify proxy path in prod
- Seed prod demo users; full flow check on prod URLs
- README final: deployment URL, Swagger URL, demo creds, tradeoff write-ups, video outline checklist

### Acceptance criteria

- Deployed flow works from clean browser: login → browse cases → view case → upload/download document
- Swagger UI reachable on deployed API
- Demo credentials documented and working in prod

---

## Phase 9 — Feedback iteration

See [`docs/feedback-plan.md`](./feedback-plan.md) for the full plan and scope decisions.

**Summary:** Addressed user feedback collected after Phases 1–8. Kept the invite-only model (no tutor-apply), kept `open/matched/closed` status lifecycle, and kept balance out of scope. Added: public self-registration (`POST /auth/register`), parent accept-tutor action (`POST /cases/:id/accept` → `MATCHED` + `matchedTutorId`), AI-mock tutor recommendation (`GET /cases/:id/recommendations`, deterministic heuristic), document soft-delete (`Document.deletedAt`), `Case.description` brief field, `GET /cases/:id/invites` list endpoint, multi-file drag-drop upload, invite-by-name directory search, parent-cases-centric nav, and welcome/signup pages. Backend gate: 95 unit + 54 e2e green. Frontend gate: lint + 47 tests + build green. Seed expanded to 3 parents, 10 tutors, 12 cases, 14 invites, 9 documents (one soft-deleted).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Prisma engines vs alpine/musl | `node:22-slim` base (D7) |
| Render cold starts look broken to reviewers | README note; optional keep-alive ping; Fly.io fallback |
| Vitest + Nest decorator metadata | `@swc/core` plugin, wired in Phase 1 so it never blocks later |
| Multipart memory blowups | Stream to S3, middleware-level size cap |
| Next 15 / shadcn breaking changes | Pin versions in Phase 1 lockfile |
| DB lookup per request (token check) | Indexed unique hash lookup; documented tradeoff (D3) |
| Scope creep | Stretch goals out of scope until Phase 8 done |

## Verification (every phase gate)

1. `pnpm lint && pnpm -r test && pnpm -r build` green
2. `docker compose up` smoke: health + FE shell
3. Phase acceptance checklist ticked in `docs/checkpoint.md`
4. Swagger reflects all new endpoints before phase closes
