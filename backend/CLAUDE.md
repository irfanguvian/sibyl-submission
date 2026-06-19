# Backend — Tuition API

NestJS 10 REST API for a tuition-matching platform. Parents post cases; tutors maintain profiles and get invited to cases. Documents attach to cases and tutor profiles via S3-compatible storage.

## Stack

- **NestJS 10** (Express platform), TypeScript 5.5, Node 22
- **Prisma 5** ORM → PostgreSQL
- **JWT auth** (`@nestjs/jwt`), bcrypt password hashing
- **Swagger** (`@nestjs/swagger`) at `/docs`, JSON at `/docs-json`
- **AWS SDK v3** S3 client (MinIO in dev) for document storage with presigned URLs
- **Biome** for lint/format, **Vitest** for unit + e2e
- **pnpm** package manager (`pnpm@10.33.0`)

## Commands

```bash
pnpm dev              # nest start --watch
pnpm build            # nest build → dist/
pnpm start:prod       # node dist/main
pnpm test             # vitest run (unit, *.spec.ts beside src)
pnpm test:e2e         # vitest run -c vitest.e2e.config.ts (test/*.e2e.spec.ts)
pnpm lint             # biome check .
pnpm format           # biome format --write .
pnpm prisma:generate  # prisma generate
pnpm db:seed          # prisma db seed (prisma/seed.ts)
```

Run a single test: `pnpm vitest run src/auth/token.service.spec.ts`.

## Layout

```
src/
  main.ts              # bootstrap: helmet, CORS allowlist, global ValidationPipe + AllExceptionsFilter, Swagger
  app.module.ts        # root module; global ThrottlerGuard (60s/100req), ConfigModule with env validation
  env.ts               # zod env schema + validateEnv() — single source of env truth
  auth/                # login/refresh/logout/me + register (POST /auth/register — @Public(), rate-limited,
                       #   bcrypt, duplicate email → 409, TUTOR bootstraps empty TutorProfile)
                       #   JWT guards (jwt-auth, roles), decorators (@CurrentUser, @Public, @Roles)
  cases/               # case CRUD, invites, case-access authorization service
                       #   + GET /cases/:id/invites (owner-only; returns [{tutorId, displayName, qualifications}])
                       #   + POST /cases/:id/accept {tutorId} (owner-only; tutor must be invited → 400 else;
                       #     second different tutor → 409; sets status=MATCHED + matchedTutorId; idempotent same-tutor)
  recommendations/     # GET /cases/:id/recommendations (owner-only)
                       #   RecommendationsService: deterministic heuristic keyword-overlap scoring;
                       #   NO external LLM; labelled "mock" in Swagger + README
  tutor-profiles/      # tutor profile upsert + public directory
                       #   profile-doc delete now soft (sets deletedAt); excluded from list/download
  documents/           # upload (multipart) + presigned download; mime allowlist (mime.ts)
                       #   + DELETE /cases/:caseId/documents/:id (uploader-only soft-delete via deletedAt)
                       #   soft-deleted docs excluded from list; download of deleted doc → 404
                       #   DocumentResponseDto now includes uploadedById
  storage/             # S3/MinIO StorageService (presigned URLs)
  prisma/              # PrismaModule + PrismaService
  common/              # pagination helper, AllExceptionsFilter
  health/              # health check
prisma/
  schema.prisma        # models: User, TutorProfile, Case, Document, CaseInvite, OauthAccessToken, OauthRefreshToken
                       #   Phase 9 fields: Case.description (String?), Case.matchedTutorId (String? + relation),
                       #   Document.deletedAt (DateTime?)
  migrations/          # SQL migrations; latest: 20260619083652_feedback_iteration
  seed.ts              # dev seed: 3 parents, 10 tutors (subject spread), 12 cases (all statuses, ≥2 MATCHED
                       #   with matchedTutorId, one budgetPerHour=1), 14 invites, 9 docs (1 soft-deleted)
test/                  # e2e specs + utils/e2e.ts harness
```

## Domain model (Prisma)

- **User** — `role: PARENT | TUTOR`, `passwordHash`. Owns cases (PARENT), gets invited (TUTOR), uploads documents. Created via login seed or `POST /auth/register`.
- **TutorProfile** — 1:1 with a TUTOR user; `displayName`, `qualifications[]`, `experiences[]`. Auto-bootstrapped on register when role is TUTOR.
- **Case** — owned by a PARENT; `status: OPEN | MATCHED | CLOSED`, `budgetPerHour` (int, min 1), optional `description` (String?), optional `matchedTutorId` (String?) pointing to the accepted tutor.
- **CaseInvite** — links a Case to an invited tutor; unique on `(caseId, tutorId)`.
- **Document** — `storedKey` is an opaque UUID in object storage, **never exposed**; attaches to a case or tutor profile; `deletedAt` (DateTime?) for soft-delete — null means active.
- **OauthAccessToken / OauthRefreshToken** — server-side token records; `tokenHash` = sha256(jti). Refresh rotates by revoking old + minting new.

## Auth model

- Backend is **stateless over HTTP**: it never sets cookies. Returns `{ accessToken, refreshToken, expiresIn }` from `/auth/login` and `/auth/refresh`.
- Clients send `Authorization: Bearer <accessToken>`. The Next.js frontend BFF holds tokens in httpOnly cookies and forwards the bearer.
- `JwtAuthGuard` protects routes by default; `@Public()` opts out. `@Roles(Role.X)` + `RolesGuard` enforce role. `@CurrentUser()` injects the authed user.
- Token TTLs from env: access 15m, refresh 7d (configurable).

## Conventions

- **DTOs** use `class-validator` + `class-transformer`; the global `ValidationPipe` runs `whitelist: true, transform: true` — unknown fields are stripped.
- **Env**: never read `process.env` directly in feature code. Add to the zod schema in `env.ts`, access via `ConfigService<Env, true>`.
- **Errors**: throw Nest `HttpException` subclasses. `AllExceptionsFilter` shapes responses and never leaks stack traces.
- **Authorization** lives in dedicated services (e.g. `case-access.service.ts`), not inline in controllers.
- Unit tests sit beside source as `*.spec.ts`; e2e tests live in `test/*.e2e.spec.ts`.
- Two-space indent, double quotes, semicolons — enforced by Biome (`biome.json`). Run `pnpm lint` before done.

## Local dev

Postgres + MinIO via the repo-root `docker-compose.yml`. Copy `.env.example` → `.env`. Key vars: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (frontend origin, comma-separated), `S3_*` (storage; `S3_PUBLIC_ENDPOINT` separates browser-reachable presign origin from in-cluster `S3_ENDPOINT`), `MAX_UPLOAD_BYTES` (default 10MB).
