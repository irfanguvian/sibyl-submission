# Decision Log

All architectural decisions for the Tuition Case Workspace. Each entry: decision, rationale, tradeoffs. See `plan.md` for phases, `research.md` for supporting notes.

---

## D1 — Monorepo via pnpm workspaces

**Decision:** Single repo: `apps/api`, `apps/web`, `packages/shared`.

**Why:**
- One repo link to submit, one place for docs.
- `packages/shared` holds zod schemas + API types consumed by both apps — FE forms and BE DTOs validate against the same source of truth.
- Single root `biome.json`, single lockfile, single CI surface.

**Tradeoffs:** Slightly more Docker build context care (`.dockerignore`, build from repo root with `pnpm deploy`). Accepted.

---

## D2 — UI: Tailwind CSS v4 + shadcn/ui

**Decision:** Tailwind v4 with shadcn/ui components, dashboard/sidebar layout from shadcn blocks.

**Why:**
- Requirement explicitly lists Tailwind + shadcn/ui as acceptable.
- shadcn CLI copies component source into the repo — no library lock-in, everything editable.
- Free responsive dashboard blocks (sidebar collapses to mobile drawer) → "easy + responsive" with minimal custom CSS.

**Tradeoffs:** Components live in our tree (we own maintenance). Fine for a take-home.

---

## D3 — Auth: JWT + server-side token persistence, FE-only cookies (BFF pattern)

**Decision:**
- API issues **JWT access token (15 min) + refresh token (7 d)**.
- Backend persists every issued token in Postgres:
  - `oauth_access_token` — id, userId, token hash (sha256 of jti/token), expiresAt, revokedAt, timestamps
  - `oauth_refresh_token` — id, accessTokenId (FK, unique), token hash, expiresAt, revokedAt, timestamps
- **Cookies exist only on the frontend domain.** Next.js route handlers act as a thin BFF/proxy:
  1. FE `POST /api/auth/login` (Next route handler) → forwards to API → receives token pair
  2. Route handler sets both tokens as **httpOnly, Secure, SameSite=Lax** cookies on the FE domain
  3. All subsequent FE→API calls go through Next route handlers, which read the cookie and forward `Authorization: Bearer <access>` to the API
- API itself is pure bearer-token — stateless transport, stateful validity (DB check).

**Validation path (API):** verify JWT signature + `exp` → look up token hash in `oauth_access_token` → reject if missing or `revokedAt` set.

**Logout:** revoke both rows (set `revokedAt`). Token is dead immediately — not just "waiting for expiry".

**Refresh:** rotation. Old access+refresh pair revoked, new pair issued and persisted. Reuse of a revoked refresh token → revoke the whole user's token family (theft signal).

**Why:**
- $0 — no hosted auth provider.
- DB-persisted tokens give **real revocation** (plain stateless JWT can't be killed early) — matches requirement's "session/token expiry behavior" and security focus.
- FE-only cookies **eliminate the cross-site cookie problem** (Vercel FE ↔ Render API): browser only ever sees same-origin cookies; the API never sets cookies at all.
- httpOnly cookies → tokens never touch JS / localStorage (XSS-resistant).

**Tradeoffs:**
- One DB lookup per authenticated request. Negligible at this scale; indexed hash lookup. Documented in README as a deliberate revocability > micro-latency choice.
- Next route-handler proxy adds a thin hop. Acceptable; also gives one place for 401 → silent-refresh → retry logic.

---

## D4 — File storage: S3 API — MinIO (dev) / Cloudflare R2 (prod)

**Decision:** All documents stored via `@aws-sdk/client-s3`. Dev: MinIO container in compose. Prod: Cloudflare R2.

**Why:**
- R2 free tier: 10 GB storage, **zero egress fees** — most budget-friendly option.
- Survives ephemeral filesystems on Render/Vercel.
- Same client code dev↔prod; only env vars differ.

**Download flow:** API re-checks authorization (per requirement §D) → returns 302 to a **60-second presigned URL**. Object keys are UUIDs; original filename lives only in DB. No storage keys or paths in API responses.

**Tradeoffs:** Needs one external account (Cloudflare, free). Accepted.

---

## D5 — Hosting: Vercel (FE) + Render (API) + Neon (Postgres)

**Decision:** All free tiers.

**Why:** $0 total; Dockerfile deploy on Render matches our optimized image; Neon gives Postgres with no card.

**Tradeoffs:** Render free tier cold-starts (~30 s after idle). Mitigation: README note for reviewers; optional keep-alive ping; Fly.io fallback if unacceptable.

---

## D6 — Testing: Vitest everywhere

**Decision:** Vitest for unit tests (api + web) and e2e (api, via supertest against a real Postgres `db_test` compose service). Playwright = stretch goal only, out of scope.

**Why:** User constraint; one test runner across the monorepo; supertest covers API happy-path + the full authz matrix well.

**Note:** Nest decorators need `emitDecoratorMetadata` → Vitest runs with the `@swc/core` plugin (see `research.md`).

---

## D7 — Docker base: `node:22-slim`, multi-stage, BuildKit caches

**Decision:** `node:22-slim` for build and runner stages (not alpine). Multi-stage: `deps → build → runner`. BuildKit cache mounts for the pnpm store. Next.js `output: "standalone"`. API runner uses `pnpm deploy --prod` output.

**Why:** Prisma engines on alpine/musl are a known friction point; slim avoids it while multi-stage + standalone keeps images small (targets: web < 300 MB, api < 400 MB).

---

## D8 — ACL semantics: 404 over 403 for existence-leak cases

**Decision:** A tutor who is not invited to a case gets **404**, not 403, when fetching it. Parents fetching another parent's case: also 404.

**Why:** Requirement §C explicitly asks us to consider existence leaks. 403 confirms the resource exists; 404 doesn't. 403 is reserved for "you can see this exists but can't do that action" (e.g., tutor trying to edit a case they're invited to).

---

## D9 — Tutor-to-tutor profile visibility: denied

**Decision:** Tutors cannot view other tutors' profiles. Directory is parent-only.

**Why:** Requirement §E says both choices are defensible; denying is the conservative default for "assume all content is sensitive" and keeps the ACL story uniform (least privilege).
