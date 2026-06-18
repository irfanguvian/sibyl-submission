# Checkpoint — Progress Tracker

Living document. Tick items as phases complete; update **Current state** after every working session.

**Last updated:** 2026-06-13 15:07 WIB
**Current state:** Phases 1–7 code complete and **Docker-runtime verified end-to-end** (daemon up): db+minio healthy, `prisma migrate dev` (init) applied + seed, both images built within budget (backend 398 MB, frontend 295 MB), backend container `/health`+`/docs`+Prisma all green, frontend BFF login→httpOnly cookies→`/auth/me` green. **Formal DB-backed e2e suites are now written and passing** (auth/cases/documents/profiles) against the compose `db_test`. Gates green: backend 62 unit + **34 e2e** + build + lint, frontend 11 + build + lint. Remaining: full live FE click-through (Phase 6) and Phase 8 deploy; nothing committed yet.

## Completion snapshot

**Overall: 7 of 8 phases verified done** (Phase 6 now fully verified via a live headless-browser click-through; Phase 8 deploy not started). All in-scope acceptance criteria met and verified live via Docker.

| Milestone | Reached (2026-06-13, WIB) |
|-----------|---------------------------|
| Docker daemon up; infra (db+minio+bucket) healthy | ~14:08 |
| `prisma migrate dev` init + seed applied | ~14:11 |
| Live runtime smoke green (auth/cases/docs/profiles) | ~14:16 |
| Both images built within budget (be 398 MB / fe 295 MB) | ~14:34 |
| Full compose stack up; container `/docs` + BFF auth green | ~14:38 |
| Formal e2e suites written + 34 passing | ~14:45 |
| `S3_PUBLIC_ENDPOINT` fix → compose browser-download 200 | ~14:51 |
| First full green gate (62 unit + 34 e2e + build + lint, fe 11) | ~14:52 |
| **Re-verified green gate + stack health** (no changes since 14:51) | **~15:07** |

**Re-checked at 15:07 WIB — still fully green, no regressions:**

| Gate | Result |
|------|--------|
| Backend lint (68 files) | ✅ clean |
| Backend unit | ✅ 62 |
| Backend e2e (vs compose `db_test`) | ✅ 34 |
| Backend build | ✅ |
| Frontend lint (40 files) | ✅ clean |
| Frontend unit | ✅ 11 |
| Frontend build | ✅ |
| Compose stack | ✅ db, db_test, minio (healthy) + backend, frontend up |
| Live endpoints | ✅ `/health` 200, `/docs` 200, `/login` 200 |

**Core gates verified-complete since ~14:52 WIB** (no app code changes since the `S3_PUBLIC_ENDPOINT` fix at 14:51). **Phase 6 live browser click-through completed ~15:1x** with no app defects found. Stack left running. Open, awaiting your go-ahead: commit (nothing committed yet), Phase 8 deploy.

## Phase status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Scaffold | ✅ code + Docker runtime verified |
| 2 | Auth & Users | ✅ code + unit + e2e (login/expiry/rotation/family-revoke/logout) |
| 3 | Cases & Invites | ✅ code + unit + e2e (ACL matrix + pagination/search/filters) |
| 4 | Documents | ✅ code + unit + e2e (upload/download/413/415/no-key-leak) |
| 5 | Tutor Profiles & Directory | ✅ code + unit + e2e (directory + D9) |
| 6 | Frontend Flows | ✅ code + component tests + live browser click-through (parent+tutor, responsive 375/768/1280) |
| 7 | Hardening, Tests, Docs | ✅ code + docs; rate-limit verified live (429) |
| 8 | Deployment & Submission | ⬜ not started |

Legend: ⬜ not started · 🟨 in progress · ✅ done (all acceptance criteria + phase gate green)

---

## Phase 1 — Scaffold

- [x] pnpm workspace root (`pnpm-workspace.yaml`, root scripts, `biome.json`, `.gitignore`, `.dockerignore`, git init)
- [x] `apps/api`: Nest scaffold (Express), strict TS
- [x] `apps/api`: Prisma init + placeholder model — schema valid; ⚠️ migration not run (no DB up)
- [x] `apps/api`: Swagger UI `/docs` + JSON `/docs-json` (wired; live render unverified)
- [x] `apps/api`: zod-validated env config, global ValidationPipe, exception filter (no stack traces)
- [x] `apps/api`: `GET /health` → 200
- [x] `apps/api`: Vitest + swc — 2 unit + 1 supertest e2e green
- [x] `apps/web`: Next App Router + Tailwind v4 + `standalone` output
- [x] `apps/web`: shadcn init + responsive dashboard shell (mobile drawer < 768 px)
- [x] `apps/web`: TanStack Query provider + API client stub
- [x] `apps/web`: Vitest + Testing Library — 5 component tests green
- [x] `packages/shared`: zod schemas package linked into both apps
- [x] Dockerfiles (api, web) multi-stage per D7 — ⚠️ written, images NOT built (Docker daemon down); sizes unverified
- [x] `docker-compose.yml`: db, db_test, minio (+ bucket bootstrap), api, web — ⚠️ written, `up` NOT run
- [x] `.devcontainer/` written — ⚠️ not opened/verified
- [x] README skeleton
- [x] **Phase gate:** lint + 13 tests + builds green; ⚠️ compose smoke deferred (Docker daemon down)

## Phase 2 — Auth & Users

- [ ] Prisma: `User` (role enum), `oauth_access_token`, `oauth_refresh_token` tables + migration
- [ ] Token service: issue (persist hash), rotate, revoke, family-revoke on refresh reuse
- [ ] `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`
- [ ] JWT guard: signature + exp + DB hash lookup (revoked check)
- [ ] `@Roles()` guard
- [ ] Seed: 1 parent + 2 tutors, creds documented
- [ ] FE BFF: Next route handlers set httpOnly cookies (FE domain only), proxy with Bearer header
- [ ] FE: login page, auth state via `/auth/me`, silent refresh + retry-once, redirect on failure
- [ ] E2E: login / wrong password / expired / rotation / reuse-kills-family / logout-immediate-401
- [ ] Swagger: auth endpoints with 401 responses
- [ ] **Phase gate**

## Phase 3 — Cases & Invites

- [ ] Prisma: `Case`, `CaseInvite` (unique pair) + migration
- [ ] `CaseAccessService` single choke point (D8: 404 over 403 for existence leaks)
- [ ] Case create/get/patch (whitelisted fields) endpoints
- [ ] List: pagination + title search + subject/level/status filters
- [ ] Invite/revoke endpoints (parent owner only)
- [ ] Edge cases: empty results, out-of-range page → empty data + meta; bad filters → 400
- [ ] E2E ACL matrix: parent-other 404 / tutor-uninvited 404 / tutor-revoked 404 / invited-view-200-edit-403
- [ ] Swagger complete
- [ ] **Phase gate**

## Phase 4 — Documents

- [ ] Prisma: `Document` model + migration
- [ ] Upload: stream → magic-byte sniff → allowlist → 10 MB cap → UUID key in MinIO/R2
- [ ] List per case (authorized)
- [ ] Download: authz re-check → 302 presigned URL (60 s)
- [ ] Errors: 415 / 413 with clean messages
- [ ] E2E: authz paths, oversized, spoofed extension, traversal filename, no-key-leak assertion
- [ ] Swagger: multipart + error codes
- [ ] **Phase gate**

## Phase 5 — Tutor Profiles & Directory

- [ ] Prisma: `TutorProfile` + migration; profile docs reuse Phase 4
- [ ] Tutor: create/edit own profile; upload/delete own profile docs
- [ ] Parent-only directory: pagination + name/keyword search; profile detail
- [ ] D9 enforced: tutor → directory/other profiles denied
- [ ] E2E ACL + directory search/pagination
- [ ] Swagger complete
- [ ] **Phase gate**

## Phase 6 — Frontend Flows

- [ ] Parent: case list (search/filter/pagination), case detail (docs, invites), create/edit case
- [ ] Parent: tutor directory + profile detail
- [ ] Tutor: profile editor + doc upload, invited-case list, case detail + upload
- [ ] RHF + zod (shared schemas) on all forms
- [ ] Loading / empty / error+retry states on every screen
- [ ] 401/403 friendly pages, no crashes
- [ ] Permission-aware UI (hide/disable per role)
- [ ] Responsive at 375 / 768 / 1280 px
- [ ] Full demo script click-through locally
- [ ] **Phase gate**

## Phase 7 — Hardening, Tests, Docs

- [ ] Coverage pass: ACL matrix, upload abuse, pagination edges
- [ ] Helmet, CORS allowlist, login rate limit
- [ ] Swagger completeness audit (DTOs, response codes, auth annotations)
- [ ] `docs/frontend.md` (architecture, state, component map)
- [ ] TSDoc: auth, access control, upload, API client
- [ ] README: auth + storage tradeoff write-ups
- [ ] `pnpm -r test` green inside Docker
- [ ] **Phase gate**

## Phase 8 — Deployment & Submission

- [ ] Neon DB + migrate deploy
- [ ] R2 bucket + creds
- [ ] API on Render (Dockerfile deploy)
- [ ] FE on Vercel (env wired)
- [ ] Prod seed users
- [ ] Clean-browser flow check: login → browse → case → docs
- [ ] Swagger URL live
- [ ] README final: URLs, creds, tradeoffs
- [ ] Video outline ready
- [ ] **Phase gate / submission ready**

---

## Session log

| Date | Phase | What happened | Blockers |
|------|-------|---------------|----------|
| 2026-06-12 | — | Plan + docs created (`decision.md`, `plan.md`, `research.md`). Auth design updated: DB-persisted tokens (`oauth_access_token` / `oauth_refresh_token`), FE-only cookies via BFF proxy. | Awaiting approval to start Phase 1 |
| 2026-06-13 | 1 | Scaffold built by 3-worker team (root+shared / api / web+docker). Lead fixed 5 cross-package integration defects at gate (biome root dep, `import type` breaking Nest DI, biome ignoring `.omc`, web↔shared `pageSize` mismatch, style). Gate green: lint clean, 13 tests pass, all builds succeed. Notes in `docs/notes.md`. | Docker daemon down → compose smoke, image sizes, live Swagger, prisma migrate all deferred. Awaiting review before Phase 2. |
| 2026-06-13 | 6 | Live headless-browser (Playwright/Chromium) click-through of the running stack via `scripts/e2e-browser-walkthrough.mjs`. Parent: dashboard, cases list (search/filter), create case (redirects to detail; row appears in DB+list), case detail (owner-only Edit/upload/invite/revoke + empty-doc state), tutor directory, tutor profile detail. Tutor: dashboard, profile editor (prefilled), invited-cases list, parent-only directory → friendly "parents-only" state (no crash). Responsive verified at 375/768/1280 (sidebar collapses to a hamburger drawer). 14 screenshots in /tmp/pw-shots. No app defects; 2 walkthrough-selector bugs fixed (matched the "New case" link / used direct nav for detail pages). | Playwright is a scratch /tmp tool, not a committed dep. |
| 2026-06-13 | 4 | Fixed the compose document-download caveat: added `S3_PUBLIC_ENDPOINT` so the backend stores via the internal `minio:9000` but signs download URLs against a browser-reachable host (`localhost:9000`). `StorageService` uses a second presign client only when the two differ (host-dev/cloud unaffected). Verified: compose download `Location=http://localhost:9000`, followed from host → 200. | — |
| 2026-06-13 | 2–5 | Wrote the deferred formal e2e suites: `test/auth.e2e.spec.ts`, `test/cases.e2e.spec.ts`, `test/documents.e2e.spec.ts`, `test/tutor-profiles.e2e.spec.ts` (+ `test/utils/e2e.ts` harness, `test/global-setup.e2e.ts`). 34 e2e pass against compose `db_test`. Storage faked (hermetic), throttler disabled via a no-op `ThrottlerStorage` override (the global APP_GUARD ThrottlerGuard can't be overridden directly), DB reset+seeded per suite. Run with `E2E_DATABASE_URL=…/tuition_test pnpm test:e2e`. | db_test host port remapped to 5441 (5433 taken by an unrelated container). |
| 2026-06-13 | 1–7 | Docker up: verified the whole deferred runtime set. Brought up db+minio+bucket, ran `prisma migrate dev` (init) + seed, built both images (backend 398 MB, frontend 295 MB — within budget), ran the full compose stack. Live-verified auth (401/429), cases ACL matrix (404/200/403/revoke), pagination/filters, document upload+download (302→presigned→200, 415/413, no key leak), tutor profiles/D9, and the frontend BFF login→httpOnly-cookie→`/auth/me` flow. Fixed 5 real defects found only at runtime: pnpm@latest minimumReleaseAge breaking frozen-lockfile, backend Dockerfile `.prisma` cherry-pick (pnpm layout), missing openssl (Prisma 1.1.x engine crash), compose backend missing S3/CORS env, `BACKEND_URL=localhost` breaking the in-container BFF. Gates re-run green (backend 62+1, frontend 11). | Formal automated e2e *spec files* still unwritten (live smoke stands in). Phase 8 deploy out of scope. Nothing committed. |
