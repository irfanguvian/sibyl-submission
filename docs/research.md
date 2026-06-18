# Research Notes

Supporting research behind the decisions in `decision.md`. Each section: what was evaluated, what we learned, what it implies for implementation.

---

## 1. Token storage: stateless JWT vs DB-persisted tokens

**Question:** plain stateless JWT, or persist issued tokens server-side?

| Approach | Revocation | Per-request cost | Complexity |
|----------|-----------|------------------|------------|
| Stateless JWT only | ❌ impossible before expiry | 0 DB hits | lowest |
| JWT + denylist (revoked jti) | ✅ | 1 lookup (only grows on logout) | medium |
| JWT + allowlist tables (`oauth_access_token` / `oauth_refresh_token`) | ✅ strongest — token invalid unless present + unrevoked | 1 indexed lookup | medium |
| Opaque tokens (no JWT) | ✅ | 1 lookup | medium, loses self-describing claims |

**Chosen:** allowlist tables (Laravel Passport-style naming, per user direction). Strongest revocation story for a security-focused review; logout is immediate; refresh-token rotation with family revocation detects token theft.

**Implementation notes:**
- Store **sha256 hash** of the token's `jti` (or full token), never the raw token — DB leak must not equal credential leak.
- Unique index on `tokenHash` → O(1) validity check.
- `oauth_refresh_token.accessTokenId` unique FK → pair rotates together.
- Cleanup: periodic delete of expired rows (cron or on-login sweep) — nice-to-have, note in Phase 7.
- Refresh-token reuse detection: presenting a revoked refresh token → revoke all of the user's active tokens (standard rotation-theft heuristic, cf. OAuth 2.1 / Auth0 guidance).

## 2. Cookie architecture: why FE-only cookies (BFF pattern)

**Problem researched:** Vercel-hosted FE and Render-hosted API are different origins. Browser third-party-cookie restrictions (Chrome phase-out, Safari ITP) make cross-site `Set-Cookie` from the API fragile even with `SameSite=None; Secure`.

**Options considered:**
1. API sets cross-site cookies — fragile (above), needs CORS credentials mode everywhere.
2. Bearer token in localStorage — XSS-readable; rejected on security grounds.
3. **BFF/proxy: Next.js route handlers own the cookies** — browser only ever talks same-origin to the FE; route handler reads httpOnly cookie and forwards `Authorization: Bearer` to API.

**Chosen:** option 3 (matches user direction: "cookies only on FE"). Side benefits:
- API stays a clean bearer-token REST API → Swagger docs use standard `bearerAuth` security scheme, trivially testable via curl/supertest.
- One place (proxy) for silent-refresh-and-retry logic.
- `SameSite=Lax` suffices; no third-party cookie risk at all.

**Implementation notes:** Next route handler at `app/api/[...path]/route.ts` as generic forwarder + dedicated `app/api/auth/*` handlers for login/logout/refresh cookie management. Never expose tokens to client components.

## 3. Docker image optimization (pnpm monorepo)

**Findings:**
- `pnpm fetch` works from lockfile alone → `COPY pnpm-lock.yaml` in its own layer caches the entire store across code changes.
- BuildKit cache mount `--mount=type=cache,id=pnpm,target=/pnpm/store` survives across builds even when the layer invalidates.
- `pnpm deploy --filter <app> --prod /out` produces a self-contained pruned package — ideal runner-stage copy for the API.
- Next.js `output: "standalone"` emits `.next/standalone` with traced node_modules → runner copies only that + `.next/static` + `public`.
- **Alpine + Prisma:** musl needs `linux-musl-openssl-3.0.x` engine target and occasionally breaks on engine updates → `node:22-slim` (Debian, glibc) is the low-friction choice; size delta acceptable after multi-stage.
- Run as non-root (`USER node`), `NODE_ENV=production`, no dev deps in runner.

**Expected results:** web runner ≈ 150–250 MB, api runner ≈ 250–350 MB; rebuild after code-only change skips dependency install entirely.

## 4. Object storage comparison (budget-first)

| Option | Free tier | Egress | S3 API | Notes |
|--------|-----------|--------|--------|-------|
| **Cloudflare R2** | 10 GB | **$0** | ✅ | chosen — zero egress is unique |
| AWS S3 | 5 GB / 12 mo | paid | ✅ | card required, egress costs |
| Supabase Storage | 1 GB | 5 GB/mo | partial | couples us to Supabase |
| Render disk | 1 GB paid | — | ❌ | not on free tier; not S3 API |
| Local filesystem | — | — | ❌ | dies on ephemeral hosts; path-traversal surface |

**Dev parity:** MinIO container in compose speaks S3 → identical client code (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), env-var-only difference.

**Download safety:** presigned GET, 60 s TTL, `response-content-disposition` set from DB-stored original filename (sanitized) → user gets a real filename without us ever trusting it for storage.

## 5. Upload safety checklist (requirement §D)

- **MIME:** sniff magic bytes (`file-type` package) — extension and client `Content-Type` are attacker-controlled. Note: docx = zip container; check zip signature + extension allowlist combination, document limitation.
- **Filenames:** never used for storage. Object key = UUID. Original name stored in DB, sanitized on output (strip control chars), only ever surfaced via `Content-Disposition`.
- **Size:** enforce at middleware level (multer/busboy `limits`) so oversize aborts mid-stream, not after buffering. 10 MB documented cap.
- **No leak rule:** API responses contain document id, originalName, size, mime, uploadedBy, timestamps — never bucket, key, or any path. E2E asserts this.

## 6. Vitest with NestJS (decorators) and Next.js

- Nest needs `emitDecoratorMetadata`; esbuild (Vitest default) doesn't emit it → use `unplugin-swc` / `@swc/core` in `vitest.config.ts`. Well-trodden setup.
- E2E: `Test.createTestingModule` + supertest against the compiled Nest app, real Postgres from compose `db_test` service; per-suite truncate between tests.
- Web: Vitest + `@testing-library/react` + jsdom for components. Async Server Components don't render in jsdom — test client components + pure logic; flow coverage comes from API e2e + manual demo script (Playwright deliberately out of scope, D6).

## 7. Hosting notes

- **Render free web service:** Docker deploy supported; sleeps after 15 min idle, ~30 s cold start; 512 MB RAM — fine for Nest.
- **Neon free:** 0.5 GB Postgres, scales to zero (also adds a cold-start hop — acceptable); pooled connection string + `directUrl` for Prisma migrations.
- **Vercel free (Hobby):** Next.js native; route handlers (our BFF proxy) run as serverless functions — keep proxy thin; 4.5 MB body limit on serverless functions → uploads >4.5 MB must go FE → API directly with bearer header from a route-handler-issued short-lived token, **or** keep cap ≤ 4 MB, **or** proxy via streaming. ⚠️ resolve during Phase 4 design — flag this when starting Phase 4.

## 8. Open questions (resolve before/during noted phase)

| # | Question | Resolve by |
|---|----------|------------|
| Q1 | Upload path vs Vercel 4.5 MB function body limit (see §7) | Phase 4 start |
| Q2 | Expired-token row cleanup strategy (cron vs on-login sweep) | Phase 7 |
| Q3 | docx magic-byte validation depth (zip signature only?) | Phase 4 |
| Q4 | Render vs Fly.io if cold starts unacceptable in demo video | Phase 8 |
