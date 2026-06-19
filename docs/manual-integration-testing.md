# Manual Integration Test Checklist

Manual, role-based walkthrough to verify the Tuition Case Workspace end-to-end
(local or deployed). Tick each box as you confirm the **expected result**.
Grounded in `requirement.md` (§A–§E) and `decision.md` (D8 existence-hiding,
D9 tutor directory is parent-only).

Routes are backend REST endpoints; pages are frontend App Router paths.

---

## 0. Setup & Preconditions

- [ ] Database seeded: `cd backend && pnpm db:seed` (wipes then inserts — see note below).
- [ ] Backend running (`pnpm dev`) or deployed; Swagger reachable at `/docs`, JSON at `/docs-json`.
- [ ] Frontend running (`pnpm dev`) or deployed and pointing at the backend.
- [ ] For quick-login buttons on a deployed env: `NEXT_PUBLIC_DEMO_MODE=true` is set.

> **Seed note:** `pnpm db:seed` **deletes all data first**, then inserts. Safe to
> re-run. It refuses to run when `NODE_ENV=production` unless `SEED_FORCE=1` is set.

### Demo credentials (all password `password123`)

| Role | Email |
| --- | --- |
| Parent | `parent@example.com` |
| Parent | `parent2@example.com` |
| Parent | `parent3@example.com` |
| Tutor | `tutor1@example.com` … `tutor10@example.com` |

File upload limits (req §D): allowed types **pdf / png / jpg / docx**, max **10 MB**.
Wrong type → **415**; oversize → rejected.

---

## 0a. Signup (Phase 9)

- [ ] `/` (root) renders the public welcome/landing page — no sidebar chrome.
- [ ] "Sign up" CTA on the landing page navigates to `/signup`.
- [ ] `/signup` shows email, password, role selector (PARENT / TUTOR). Selecting TUTOR reveals a displayName field.
- [ ] Submit valid PARENT signup → account created; redirected to `/login`; can log in immediately (`POST /auth/register` → 201).
- [ ] Submit valid TUTOR signup (with displayName) → account created; TUTOR profile bootstrapped; log in and visit `/profile` to confirm profile exists (`GET /tutor-profiles/me` → 200).
- [ ] Duplicate email → inline error (409).
- [ ] Already-authenticated user visiting `/` → redirected to `/cases` (no flash of landing page).

Endpoints exercised: `POST /auth/register`.

---

## 1. Auth & Sessions (req §A) — all roles

- [ ] `/login` page renders **without** the dashboard sidebar chrome.
- [ ] Login with valid parent creds → redirected to home; `GET /auth/me` returns role `PARENT`.
- [ ] Logout (header button) → returns to `/login`; protected pages now redirect to `/login`.
- [ ] Login with **invalid** creds → inline error, no crash, stays on `/login` (`POST /auth/login` → 401).
- [ ] Visiting a protected route while logged out → redirected to `/login` (no 401 error spam / blank screen).
- [ ] Demo quick-login: `Sign in as Parent` / `Sign in as Tutor` buttons visible only when `NEXT_PUBLIC_DEMO_MODE=true`; clicking signs in and lands on home.
- [ ] Token expiry behavior: with an expired/invalid session, the app recovers gracefully (silent refresh or redirect to `/login`), never a stack trace.

Endpoints exercised: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.

---

## 2. Parent flows

### 2a. Tutor directory & profiles (req §E)

- [x] `/tutors` lists tutor profiles, **paginated**; all 6 seeded tutors discoverable.
- [x] Search by name (e.g. `Aisha`) filters the directory (`GET /tutor-profiles?...`).
- [x] Open a tutor `/tutors/[id]` → detail shows displayName, qualifications, experiences (`GET /tutor-profiles/:id`).
- [ ] Tutor profile documents listed and downloadable (`GET /tutor-profiles/:id/documents`). no document uploaded from tutor ( can be see)

### 2b. Cases — create / list / view / edit (req §B)

- [x] `/cases/new` → create a case (title, subject, level, location, budgetPerHour) (`POST /cases`). ( budget can fill zero, it should not be like that)
- [x] `/cases` lists **only own** cases, paginated (`GET /cases`).
- [x] Search by title keyword filters the list.
- [x] Filter by subject / level / status works.
- [x] **Empty results**: a filter matching nothing shows an empty state, not a crash.
- [x] **Out-of-range page**: requesting a page beyond the last returns empty/last page gracefully.
- [x] `/cases/[id]` shows case detail (`GET /cases/:id`).
- [x] `/cases/[id]/edit` updates editable fields (`PATCH /cases/:id`); changes persist.

* budget can fill with zero ( prevent it)
* document is upload only, cannot be erase or updated. mitigate flow where it can be erase and upload again
* document can upload many or drop. state now can only single upload
* invite tutor is using name instead of id, because in UI there is no ID. parent dont know the IDs. also is better to have a recomendation one base on qualification and experience ( this is llm, i think make mocks so it mocking ai call to give recomendation of tutor with same subject and qualification)
* while searching name in invite tutor, search by name. in entry display the name with qualifications
* on inviting tutor, we dont know that tutor is already invited or not. should have a feature listed that tutor invited into the cases. so invoking can be in list entry not in searching button

### 2c. Invites — search, invite, list, accept (req §C, Phase 9)

- [ ] On the case detail page (owner view) the invite panel shows a name-search input.
- [ ] Type a partial tutor name → matching tutors appear with displayName + qualifications (`GET /tutor-profiles?search=…`).
- [ ] Click **Invite** on a result → tutor appears in the "Invited tutors" list (`POST /cases/:id/invites`; `GET /cases/:id/invites` → 200).
- [ ] The invited-tutors list shows each tutor's name and qualifications, with **Accept** and **Revoke** buttons.
- [ ] Click **Revoke** → tutor removed from the list (`DELETE /cases/:id/invites/:tutorId`).
- [ ] Re-invite the same tutor → they reappear; the list is always current.
- [ ] Click **Accept** on an invited tutor → case status changes to MATCHED; a matched-tutor badge appears; the Accept button is disabled for all other tutors (`POST /cases/:id/accept { tutorId }` → 200).
- [ ] Attempting to accept a second different tutor → 409 error surfaced in the UI.
- [ ] Tutor who is not invited cannot see the invite panel (owner-only).

Endpoints exercised: `POST /cases/:id/invites`, `DELETE /cases/:id/invites/:tutorId`, `GET /cases/:id/invites`, `POST /cases/:id/accept`.

### 2d. AI tutor recommendations (Phase 9)

- [ ] On the case detail page (owner view) the "Suggested tutors" (AI mock) panel is visible.
- [ ] Panel shows a loading skeleton while fetching (`GET /cases/:id/recommendations`).
- [ ] At least one tutor is suggested for a case whose subject matches seeded tutor qualifications (e.g. a Math case → Math tutors ranked first).
- [ ] Empty state renders when no tutors match (e.g. a case with an obscure subject).
- [ ] Non-owner (another parent or an uninvited tutor) cannot access the recommendations endpoint → 404.
- [ ] Panel is clearly labelled "AI-suggested (mock)" — no claim of a live LLM.

Endpoint exercised: `GET /cases/:id/recommendations`.

### 2e. Case documents — multi-upload, grouping, soft-delete (req §D, Phase 9)

- [ ] Upload **multiple** pdf/png/jpg/docx files at once via drag-and-drop or multi-select → each uploads individually; all appear in the list (`POST /cases/:caseId/documents` once per file).
- [ ] Reject **unsupported type** (e.g. `.exe`) → per-file inline error; server returns **415**.
- [ ] Reject **oversize** (>10 MB) → rejected before/at upload.
- [ ] Documents in the list are **grouped by uploader**: a "Parent documents" section and a "Tutor documents" section (only the sections with content are shown).
- [ ] Each document row shows the uploader's name/role and has a **Download** link and a **Delete** button (Delete visible only to the uploader).
- [ ] Click **Delete** on own document → document disappears from the list immediately (soft-delete: `DELETE /cases/:caseId/documents/:id`; `deletedAt` set server-side).
- [ ] Attempt to download a soft-deleted document directly (via its URL) → **404**.
- [ ] Non-uploader cannot see the Delete button for another user's document.
- [ ] Download a document → file downloads; no storage path/key exposed in responses.

Endpoint exercised: `POST /cases/:caseId/documents`, `GET /cases/:caseId/documents`, `DELETE /cases/:caseId/documents/:id`, `GET /documents/:id/download`.

### 2f. Parent negative cases (D8)

- [ ] Parent A opening Parent B's case id → **404** (not 403), no existence leak.

---

## 3. Tutor flows

### 3a. Own profile (req §E, Phase 9)

- [ ] `/profile` → create/edit own profile: displayName, qualifications, experiences (`PUT /tutor-profiles/me`, `GET /tutor-profiles/me`).
- [ ] Upload a supporting document to own profile via dropzone (`POST /tutor-profiles/me/documents`).
- [ ] Delete a profile document (`DELETE /tutor-profiles/me/documents/:docId`) → document disappears from the list (soft-delete via `deletedAt`; row preserved in DB).
- [ ] Upload a replacement document after deleting → new document appears; the soft-deleted one remains absent.

### 3b. Invited cases (req §C, §D)

- [x] Tutor sees a case they were **invited** to and opens its detail (`GET /cases/:id`).
- [x] Tutor uploads a sample worksheet to an invited case (`POST /cases/:caseId/documents`).
- [x] Tutor downloads case documents (`GET /documents/:id/download`).

### 3c. Tutor negative cases (D8, D9)

- [ ] Tutor opening a case they are **not** invited to → **404**.
- [ ] Tutor cannot edit a case (no edit controls; `PATCH /cases/:id` → 403).
- [ ] Tutor cannot view another tutor's profile / the directory → blocked per D9 (`/tutors`, `GET /tutor-profiles/:id`).

---

## 4. Permissions / Security matrix (req §C, §D)

- [ ] Any protected route with **no** auth → **401**.
- [ ] Tutor edits a case they're invited to → **403**.
- [ ] Tutor fetches a case they're not invited to → **404** (D8).
- [ ] Parent fetches another parent's case → **404** (D8).
- [ ] Download a document while logged out / as wrong user → re-checked, denied (401/403/404).

- [ ] UI **hides/disables** actions the current role can't perform.
- [ ] 401/403 responses render gracefully (no crash / blank screen).
- [ ] Download re-checks authorization server-side (copy a download link, hit it logged out → denied).
- [ ] No stack traces or server filesystem paths leak in any error response.

---

## 5. Robustness states (Assess §1)

- [ ] Directory, case list, and case detail each show a **loading** state.
- [ ] **Empty** states render (no cases / no documents / no search matches).
- [ ] **Error / retry** state appears on a failed fetch (e.g. backend down), and recovers on retry.

---

## 6. Cross-role happy path (mirrors video walkthrough, req §40–44)

End-to-end sequence — do it in order:

- [ ] **Tutor** (`tutor1@example.com`): set up profile (qualifications, experience) and upload a document.
- [ ] **Parent** (`parent@example.com`): browse the tutor directory, open that tutor's profile.
- [ ] **Parent**: create a case, **invite that tutor**, upload a document to the case.
- [ ] **Tutor** (`tutor1@example.com`): open the invited case and view the parent's uploaded document.

---

## Coverage map

- **Routes:** auth (§0a, §1), signup (§0a), cases + invites + accept (§2b–2c, §3b), recommendations (§2d), tutor-profiles (§2a, §3a, §3c), documents with soft-delete (§2e, §3a, §3b, §4).
- **Pages:** `/` welcome (§0a), `/signup` (§0a), `/login` (§1), `/cases` (§2b), `/cases/new` (§2b), `/cases/[id]` (§2b, §2c, §2d, §2e, §3b), `/cases/[id]/edit` (§2b), `/tutors` (§2a, §3c), `/tutors/[id]` (§2a), `/profile` (§3a).
- **Requirements:** §A (§0a, §1), §B (§2b), §C (§2c, §3b, §3c, §4), §D (§2e, §3b, §4), §E (§2a, §3a).
- **Phase 9 additions:** signup flow (§0a), invite-by-name + accept-tutor + matched badge (§2c), AI-mock recommendations panel (§2d), multi-upload + doc grouping + soft-delete (§2e), profile-doc soft-delete + re-upload (§3a).
