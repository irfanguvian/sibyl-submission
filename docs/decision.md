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

---

## D10 — Parent accept-tutor: one tutor per case → MATCHED + matchedTutorId

**Decision:** `POST /cases/:id/accept { tutorId }` (parent/owner only) sets `status = MATCHED` and `matchedTutorId`. Accepting a second *different* tutor returns **409**. Re-accepting the same tutor (idempotent) returns 200.

**Why:**
- Requirement §B specifies a `matched` status; this gives it a concrete trigger and a clear FK record of *which* tutor was matched.
- One-tutor-per-case is the product decision (invite-only model, not a marketplace auction): once matched, the case is fulfilled.
- Idempotent same-tutor prevents spurious UI-retry errors.

**Tradeoffs:** No "unmatch" endpoint in this phase — a parent wanting to switch tutors must close the case and open a new one. Acceptable for the current scope.

---

## D11 — Public self-registration via POST /auth/register

**Decision:** Added `POST /auth/register` (`@Public()`, rate-limited) accepting `{ email, password, role, displayName? }`. Bcrypt hash stored; duplicate email → 409; invalid role → 400; TUTOR role auto-bootstraps an empty `TutorProfile`.

**Why:**
- Seeded demo accounts suffice for reviewers, but a real service needs signup — and the frontend was missing a `/signup` page entirely (feedback item).
- `@Public()` + rate-limiting matches the existing login pattern (5 req/min/IP), so the attack surface is no wider.
- Bootstrapping the `TutorProfile` on register avoids a broken initial state where a tutor has no profile row.

**Tradeoffs:** Self-registration means any role is selectable. Mitigated by: bcrypt, rate-limit, role allowlist (PARENT | TUTOR only — no ADMIN escalation path), and duplicate-email guard.

---

## D12 — AI tutor recommendation: deterministic mock, no external LLM

**Decision:** `GET /cases/:id/recommendations` (owner-only) returns a ranked list of tutors scored by keyword overlap between the case's subject/description and tutors' qualifications. Implemented entirely in `RecommendationsService` — no external API call, no network dependency.

**Why:**
- Requirement lists AI tutor recommendation as a stretch goal; a stub satisfies it without introducing an LLM dependency, API key management, or non-deterministic test behaviour.
- Deterministic scoring means unit tests can assert exact orderings, and the feature never fails due to rate limits or external downtime.
- Clearly labelled "mock" in Swagger (`@ApiOperation` summary) and README so reviewers understand the intent.

**Tradeoffs:** Not a real AI recommendation. The heuristic (keyword overlap) is a reasonable stand-in that demonstrates the integration surface (endpoint, owner-only auth, response shape) without the operational overhead of a live LLM.

---

## D13 — Document deletion: soft-delete via deletedAt

**Decision:** `Document.deletedAt DateTime?` added to schema. Deleting a document sets this timestamp rather than removing the row. All list and download queries filter `deletedAt: null`; a download of a soft-deleted document returns **404**.

**Why:**
- Feedback item: parents and tutors need to delete and re-upload documents. Hard-delete would orphan the S3 object (async cleanup needed) or require synchronous S3 delete in the request path — adding latency and a failure mode.
- Soft-delete keeps the DB row (audit trail, no FK cascade risk) while making the document invisible to all business logic.
- Profile-doc delete (`DELETE /tutor-profiles/me/documents/:id`) converted to soft-delete under the same pattern for consistency (D9-area ACL unchanged).

**Tradeoffs:** S3 objects accumulate until a background cleanup job runs (not implemented in this phase). For the assessment scope this is acceptable; documented in README.

---

## D14 — Case.description: optional brief text field

**Decision:** `Case.description String?` added. Surfaced in create/update DTOs, `CaseResponseDto`, case form, and case detail view.

**Why:**
- Feedback item: tutors looking at a case had no context beyond the structured fields (subject, level, location, budget). A free-text brief lets parents explain what they need, so tutors can evaluate the invitation meaningfully.
- Optional (`String?`) so existing cases and the create flow are not broken — an empty description is valid.

**Tradeoffs:** Unstructured text; no character limit enforced at the DB layer (application-level validation can be added later). Accepted for this phase.
