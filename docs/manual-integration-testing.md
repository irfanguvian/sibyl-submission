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
| Tutor | `tutor1@example.com` … `tutor6@example.com` |

File upload limits (req §D): allowed types **pdf / png / jpg / docx**, max **10 MB**.
Wrong type → **415**; oversize → rejected.

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

- [ ] `/tutors` lists tutor profiles, **paginated**; all 6 seeded tutors discoverable.
- [ ] Search by name (e.g. `Aisha`) filters the directory (`GET /tutor-profiles?...`).
- [ ] Open a tutor `/tutors/[id]` → detail shows displayName, qualifications, experiences (`GET /tutor-profiles/:id`).
- [ ] Tutor profile documents listed and downloadable (`GET /tutor-profiles/:id/documents`).

### 2b. Cases — create / list / view / edit (req §B)

- [ ] `/cases/new` → create a case (title, subject, level, location, budgetPerHour) (`POST /cases`).
- [ ] `/cases` lists **only own** cases, paginated (`GET /cases`).
- [ ] Search by title keyword filters the list.
- [ ] Filter by subject / level / status works.
- [ ] **Empty results**: a filter matching nothing shows an empty state, not a crash.
- [ ] **Out-of-range page**: requesting a page beyond the last returns empty/last page gracefully.
- [ ] `/cases/[id]` shows case detail (`GET /cases/:id`).
- [ ] `/cases/[id]/edit` updates editable fields (`PATCH /cases/:id`); changes persist.

### 2c. Invites (req §C)

- [ ] On a case, invite a tutor (`POST /cases/:id/invites`) → tutor appears in invited list.
- [ ] Revoke that invite (`DELETE /cases/:id/invites/:tutorId`) → tutor removed; Revoke is a real button.

### 2d. Case documents (req §D)

- [ ] Upload a pdf/png/jpg/docx ≤10 MB to a case via drag-and-drop dropzone (`POST /cases/:caseId/documents`).
- [ ] Reject **unsupported type** (e.g. `.exe`) → client/inline error, server returns **415**.
- [ ] Reject **oversize** (>10 MB) → rejected before/at upload.
- [ ] List case documents (`GET /cases/:caseId/documents`).
- [ ] Download a case document (`GET /documents/:id/download`) → file downloads; no storage path/key exposed in responses.

### 2e. Parent negative cases (D8)

- [ ] Parent A opening Parent B's case id → **404** (not 403), no existence leak.

---

## 3. Tutor flows

### 3a. Own profile (req §E)

- [ ] `/profile` → create/edit own profile: displayName, qualifications, experiences (`PUT /tutor-profiles/me`, `GET /tutor-profiles/me`).
- [ ] Upload a supporting document to own profile via dropzone (`POST /tutor-profiles/me/documents`).
- [ ] Delete a profile document (`DELETE /tutor-profiles/me/documents/:docId`).

### 3b. Invited cases (req §C, §D)

- [ ] Tutor sees a case they were **invited** to and opens its detail (`GET /cases/:id`).
- [ ] Tutor uploads a sample worksheet to an invited case (`POST /cases/:caseId/documents`).
- [ ] Tutor downloads case documents (`GET /documents/:id/download`).

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

- **Routes:** auth (§1), cases + invites (§2b–2c, §3b), tutor-profiles (§2a, §3a, §3c), documents (§2d, §3b, §4).
- **Pages:** `/login` (§1), `/` home (§1, §2), `/cases` (§2b), `/cases/new` (§2b), `/cases/[id]` (§2b, §3b), `/cases/[id]/edit` (§2b), `/tutors` (§2a, §3c), `/tutors/[id]` (§2a), `/profile` (§3a).
- **Requirements:** §A (§1), §B (§2b), §C (§2c, §3c, §4), §D (§2d, §3b, §4), §E (§2a, §3a).
