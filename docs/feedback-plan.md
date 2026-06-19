# Feedback Iteration Plan (Phase 9)

**Status:** pending approval — no code written yet.
**Source:** `docs/feedback.md` triaged against `docs/requirement.md`.
**Baseline:** Phases 1–8 (`docs/checkpoint.md`) — backend 62 unit + 34 e2e + build + lint green; frontend 11 unit + build + lint green.

---

## Scope decisions (locked)

| Topic | Decision |
|-------|----------|
| Tutor "apply to cases" (LinkedIn model) | **No.** Stay invite-only per req §C. |
| Parent "accept tutor" action | **Yes.** One tutor per case → case `MATCHED`. |
| Status lifecycle | **Keep** `open / matched / closed`. No extended workflow. |
| Tutor balance on case-done | **No.** Out of scope. |
| AI feature | **Mock best-match tutor recommendation** (req stretch goal). |
| Parent UI | **Refocus** away from dashboard, cases-centric. |
| Signup | **Yes.** Add self-registration. |
| Welcome/landing page | **Yes.** |

**Already-present (FE-surfacing only, no backend work):** tutor self profile-doc upload/delete (`tutor-profiles.controller.ts:80-129`); parent view of tutor profile docs (`:id/documents`). Invite already takes `tutorId` UUID — the gap is FE name-search→pick, not backend.

---

## Feedback → resolution map

| Feedback item | Bucket | Resolution |
|---------------|--------|-----------|
| budget can be zero | fix | `@Min(1)` on create/update DTO |
| doc cannot be erased/re-uploaded | req §E | case-doc soft-delete (profile-doc delete exists → make soft) |
| single upload only, want many/drop | enhance | FE multi/drag-drop (existing `file-dropzone.tsx`), loops existing single endpoint per-file (keeps 413/415) |
| invite by name, no IDs in UI | req §E | FE directory search-by-name → pick → send id |
| AI tutor recommendation by subject/qual | stretch | mock `GET /cases/:id/recommendations` |
| search shows name + qualifications | req §E | FE directory entry |
| see which tutors already invited | req §C | `GET /cases/:id/invites` + FE list |
| parent accept tutor (1 per case) | decided | `POST /cases/:id/accept` → `MATCHED` + `matchedTutorId` |
| tutor sees invitations, filterable | req §C | FE tutor invited-cases view |
| case brief/description for tutors | enhance | optional `Case.description` |
| separate doc lists parent vs tutor | enhance | FE grouping by uploader |
| parent sees tutor docs on profile | req §E | FE-surface existing endpoint |
| drop dashboard for parent | decided | FE refocus |
| LinkedIn apply model | rejected | invite-only kept |
| tutor doc soft-delete + re-upload | req §E | convert profile-doc delete to soft; FE surface |
| tutor apply cases | rejected | — |
| tutor status menu / balance | rejected | keep enum; balance out |
| welcome + signup page | decided | add both |

---

## Part 1 — Schema & migration (single migration)

- `Case.description String?`
- `Case.matchedTutorId String?` + relation `matchedTutor User?` (the accepted tutor)
- `Document.deletedAt DateTime?` (soft-delete; exclude from list/download)
- `prisma migrate dev --name feedback_iteration`; regenerate client; update `seed.ts` (descriptions, one matched case for demo).

## Part 2 — Backend

1. **Budget**: `@Min(1)` in `create-case.dto.ts` + `update-case.dto.ts`; message documented.
2. **Description**: add to create/update DTO + `CaseResponseDto`; persist + return.
3. **Case-doc soft-delete**: `DELETE /cases/:caseId/documents/:id` (uploader-only via `CaseAccessService`); set `deletedAt`; exclude soft-deleted from `listForCase` + `getDownloadUrl` (→ 404).
4. **Profile-doc delete**: verify `deleteOwnProfileDocument` is hard → switch to `deletedAt`; exclude in `listForProfile`.
5. **List invites**: `GET /cases/:id/invites` (owner only) → `[{ tutorId, displayName, qualifications }]`. Non-owner → 404 (D8).
6. **Accept tutor**: `POST /cases/:id/accept` `{ tutorId }` (owner only). Tutor must be invited. Sets `status=MATCHED`, `matchedTutorId`. Reject if already matched (409) → enforces one-per-case. Idempotent same-tutor.
7. **AI recommendation (mock)**: `recommendations.service.ts` + `GET /cases/:id/recommendations` (owner only). Deterministic stub: score tutors by subject/qualification keyword overlap with the case, return top N. Clearly labelled mock in Swagger + README. No external LLM call.
8. **Signup**: `POST /auth/register` `{ email, password, role, displayName? }`. bcrypt hash; duplicate email → 409; if `TUTOR`, bootstrap empty `TutorProfile`. Rate-limited like login. `@Public()`.
9. Swagger annotations on every new endpoint (DTOs, 4xx codes, `@ApiBearerAuth`).

## Part 3 — Frontend

- **Welcome/landing** page at `/` (pre-login); CTA → login/signup.
- **Signup** page + RHF/zod form (role select, tutor displayName).
- **Parent UI refocus**: cases-centric layout, de-emphasize dashboard chrome.
- **Invite UX**: directory search-by-name (entry shows name + qualifications) → invite by id; invited-tutors list on case detail with revoke + **accept** buttons; matched state badge.
- **Case description** in create/edit form + detail view.
- **Documents**: multi / drag-drop upload (`file-dropzone.tsx`); delete (soft) own docs; grouped by uploader (parent vs tutor).
- **Tutor**: invited-cases filtered view; surface own profile-doc upload/delete; case detail shows brief + both doc groups.
- **AI panel**: "Suggested tutors" on parent case detail (loading/empty/error states).
- Preserve 401/403 friendly states + permission-aware hide/disable.

---

## Part 4 — Unit tests (the ask)

**Backend (`*.spec.ts` beside src):**
- `cases.service.spec.ts`: budget<1 rejected; description persisted; accept→MATCHED+matchedTutorId; accept uninvited tutor rejected; second accept → 409; list-invites owner-only.
- `documents.service.spec.ts`: case-doc soft-delete hides from list + download→404; delete authz (only uploader); profile-doc soft-delete.
- `recommendations.service.spec.ts` (new): scoring/ordering, subject+qual overlap, empty directory, top-N cap.
- `auth.service.spec.ts`: register hashes password, duplicate→409, TUTOR bootstraps profile, role validation.

**Frontend (Vitest + RTL):**
- signup form (validation, role select, submit).
- welcome page (render + redirect when authed).
- invite search→pick component.
- invited-tutors list (accept/revoke gating).
- doc list grouped + delete + multi-upload (extend `file-dropzone.test.tsx`).
- recommendation panel (render/empty/error).

## Part 5 — Integration / e2e tests (the ask)

**Backend supertest vs compose `db_test`:**
- `auth.e2e.spec.ts`: register happy → login works; duplicate email 409; invalid role 400.
- `cases.e2e.spec.ts`: budget=0 → 400; description round-trips; `GET invites` owner 200 / non-owner 404; accept → MATCHED + tutor gains access; accept 2nd tutor → 409; recommendations owner-only + ranking + non-owner 404.
- `documents.e2e.spec.ts`: case-doc soft-delete → absent from list + download 404; delete by non-uploader → 403/404; multi-upload; profile-doc soft-delete still ACL-guarded (D9).
- `tutor-profiles.e2e.spec.ts`: re-assert D9 + profile-doc delete soft.

**Frontend integration:** extend `scripts/e2e-browser-walkthrough.mjs` for signup→login, invite→accept→matched, doc delete, recommendation panel. (Playwright remains a scratch tool, not a committed dep — same as today.)

---

## Part 6 — Seeder update (final code phase, before docs)

Refresh `backend/prisma/seed.ts` to exercise the new flow + give richer demo/manual-test data. Keep the existing wipe-then-upsert pattern, deterministic UUIDs, prod-wipe guard, and S3 byte-upload-with-fallback.

**New-flow coverage:**
- **`description`** on every seeded case (brief text so tutors understand the request).
- **Matched case via accept**: set `matchedTutorId` on the `MATCHED` case (case 202 → tutor1) so the accepted-tutor state renders without manual clicks.
- **Soft-deleted document**: seed one case-doc with `deletedAt` set → proves lists/downloads exclude it (manual + demo).
- **Signup**: leave seeded users as-is (documented creds) but add a README note that signup also works; optionally seed one user created "as if via signup" to show parity.
- **Recommendation demo**: ensure tutor `subject`/`qualifications` overlap several open cases so the mock best-match returns meaningful, non-empty results (e.g. multiple Math/Physics tutors vs the Math/Physics cases).

**More data (richer, but bounded for fast seed):**
- Parents: 2 → **3**.
- Tutors: 6 → **~10**, spread across subjects (Math, English, Physics, Chemistry, Chinese, Accounts, CS/Coding, Biology, Economics) so the directory paginates and search/filter is exercisable.
- Cases: 5 → **~12**, mix of all statuses + varied subjects/levels/locations/budgets, several `OPEN` (drives recommendations + invite demo), a couple `MATCHED` (with `matchedTutorId`), one `CLOSED`. Include long + short descriptions and an edge case (min budget = 1).
- Invites: more invited-but-not-accepted tutors across open cases (drives the invited-tutors list + accept button).
- Documents: a few more case-docs (parent brief + tutor sample on the same case → exercises uploader grouping) and profile docs across several tutors; one soft-deleted.

**Constraints:** seed stays idempotent + fast (no huge loops); doc bytes reuse the existing `SAMPLE_PDF`/`SAMPLE_PNG`; update the credentials/summary JSDoc block at the top.

**Verify:** `pnpm db:seed` runs clean against compose db; counts logged; directory paginates; one matched case + one soft-deleted doc + non-empty recommendations all present.

## Part 7 — Docs update (final)

| Doc | Update |
|-----|--------|
| `decision.md` | D10 accept/matched-tutor, D11 signup, D12 AI mock, D13 soft-delete, D14 case description |
| `plan.md` | reference this Phase 9 |
| `checkpoint.md` | Phase 9 rows + session log |
| `frontend.md` | new pages/components (welcome, signup, invite-search, recommendation, doc grouping) |
| backend `CLAUDE.md` + READMEs | new endpoints, signup, AI-mock note, soft-delete, demo creds (seeded + signup) |
| `manual-integration-testing.md` | new manual flows |
| `video-walkthrough-script.md` | new flows |
| `feedback.md` | annotate each item resolved / rejected (+ why) |
| Swagger | auto-generated from decorators — verified complete for new endpoints |
| `requirement.md` | **untouched** (external brief) |

---

## Part 8 — Verification gate (acceptance)

All must be green before "done":

```
# backend
cd backend && pnpm lint && pnpm test && pnpm test:e2e && pnpm build
# frontend
cd frontend && pnpm lint && pnpm test && pnpm build
```

Plus: migration applies cleanly; seed runs; Swagger renders new endpoints; compose stack smoke (login → case → invite → accept → docs). e2e needs compose `db_test` up (port 5441 per project memory).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Signup widens attack surface | rate-limit, role allowlist, bcrypt, no auto-login of arbitrary role escalation |
| Soft-delete missed in a query path | central filter `deletedAt: null` in service queries; e2e asserts download 404 |
| AI mock mistaken for real | label "mock" in Swagger + README; deterministic, no network |
| Accept race (two parents... n/a) / double accept | DB check + 409; one-per-case via `matchedTutorId` guard |
| Scope creep back into rejected items | this doc is the contract; rejected items stay rejected |
