# Tuition Case Workspace — Take-Home (Full-Stack)

## Overview
Build a small full-stack web app for a **tuition marketplace**: **parents** post **tuition cases** (a request to find a tutor for a child) and **tutors** browse, get invited to, and respond to them. Cases can carry **documents** (assignment briefs, past papers, sample worksheets) and have **fine-grained access control** between the parent and any tutors they invite.

This is the kind of platform you'd be working on day-to-day. It is a reliability + security focused exercise (not just UI polish).

You will build:
- **Backend REST API** (you design the endpoints)
- **React frontend** that consumes your API — **Next.js (App Router) preferred**
- **PostgreSQL database**

> Assume all content is sensitive. Prioritize correctness, stability, and secure handling.
ss
---

## Submission Requirements (Important)

### 1) Documentation (required)
You will be assessed on the quality of your documentation and clarity of implementation.

- **Backend:** Provide **Swagger / OpenAPI docs** for your API (e.g., Swagger UI).
  - Must be accessible locally and/or via your deployment.
- **Frontend:** Provide documentation for your frontend architecture and components (choose one):
  - Storybook **or** a `/docs` page **or** a well-structured `docs/` folder in the repo.
- **Code documentation:** Use clear comments where appropriate, and include concise JSDoc/TSDoc for key modules (auth, access control, upload handling, API client, etc.).

### 2) Deployment (required)
Deploy your solution so we can access it without running it locally.

Deploy on your preferred service (e.g. Vercel, Render, Fly.io, Azure App Services, etc.).

> Your deployed app should be functional end-to-end (login → browse cases → view case → documents).

### 3) UI (required, but flexible)
There's no Figma — the UI is up to you. Build something that covers the flows (login, tutor directory + profile, parent case browse/detail, tutor case browse/detail, document upload/download) and feels usable. That's it.

We're **not strict** about how it looks. Use whatever component library, styling approach, or aesthetic you're comfortable with — Tailwind, shadcn/ui, Material UI, Chakra, plain CSS, your own design — all fine. Just keep it reasonably consistent and easy to navigate.

### 4) Video walkthrough (required)
Record a **short screen recording (5–10 minutes)** of yourself walking through:
- A quick demo of the deployed app — log in as a tutor and set up your profile (qualifications, experience, an uploaded doc); then log in as a parent, browse the tutor directory, create a case, invite that tutor, upload a document; then back to the tutor to view the case.
- A brief explanation of **how it works under the hood**: how you structured auth, how access control is enforced server-side, where state lives, how documents are uploaded/stored/downloaded safely.
- Anything you're proud of or would improve with more time.

Submit the recording as an **unlisted YouTube link, Loom link, or Google Drive link** (any viewable URL is fine).

This is how we get a feel for how you think and communicate as much as how you code.

---

## Stack Preferences

You can choose any stack you're productive in, but if you want to mirror what you'd actually be working with:

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS, with TanStack Query for data fetching and React Hook Form for forms.
- **Backend:** Node.js + TypeScript. NestJS or Express/Hono are all fine. Prisma ORM preferred (but optional).
- **Database:** PostgreSQL.
- **Auth:** Anything sensible (cookie sessions, JWT, or a hosted auth provider). Explain your choice.

If you choose something different (e.g. plain React + Vite, Fastify, Drizzle), that's fine — just explain why in the README.

---

## Functional Requirements

### A) Users, Auth, and Sessions
Roles:
- **Parent**
- **Tutor**

Must support:
- Login / Logout
- "Current user" (who am I)
- Session/token expiry behavior (how the app behaves when auth becomes invalid)

Implementation:
- Cookie sessions **or** JWT **or** a hosted provider (Supabase Auth, Clerk, Auth0) are all acceptable. Explain your choice and tradeoffs in the README.

Security expectations:
- Passwords must be hashed (if implementing password auth)
- Do not leak stack traces or internal details to clients

---

### B) Tuition Cases
A Case is a parent's request for a tutor. Minimally include:
- `title` (e.g. "Weekly P5 Math tuition near Bishan")
- `subject` (e.g. Math, English, Chinese, Physics — string is fine)
- `level` (e.g. `P1`–`P6`, `S1`–`S5`, `JC1`–`JC2` — string/enum is fine)
- `location` (free-text; geocoding not required)
- `budgetPerHour` (number, currency-agnostic)
- `status` (e.g. `open`, `matched`, `closed`)
- `owner` (parent)
- timestamps

Must support:
- Create a case (**parent**)
- View a case (**authorized users only**)
- Edit some case fields (**parent owner only**)
- List cases with:
  - pagination
  - search (title/keyword)
  - filtering (subject, level, status)

Edge cases:
- Empty results
- Out-of-range pages
- Partial/optional data fields

---

### C) Case Access (Permissions)
Authorization rules:
- A **parent** can access only their own cases
- A **tutor** can access only cases they have been **invited to** by the parent
- A **parent** can invite/revoke tutor access on a case (think: a small "invited tutors" list per case)

Status code expectations:
- `401` unauthenticated
- `403` authenticated but not allowed
- `404` not found (avoid leaking existence where appropriate — explain your choice)

Frontend must:
- reflect permissions in the UI (hide/disable actions)
- still handle `403`/`401` gracefully (no crash / blank screen)

---

### D) Documents (File Upload & Download)
A Document belongs to a case and minimally includes:
- original filename (stored safely)
- size
- type (MIME/extension)
- `uploadedBy`
- timestamps

Use cases to imagine: a parent uploads the child's past paper or a homework brief; an invited tutor uploads a sample worksheet.

Must support:
- Upload document to a case (**authorized users only**)
- List documents for a case (**authorized users only**)
- Download a document (**authorized users only**)

File constraints:
- Enforce allowed types (e.g., `pdf/docx/png/jpg`)
- Enforce max size (you choose; document it)
- Handle errors properly (unsupported type, too large, etc.)

Security expectations:
- Prevent path traversal / unsafe filenames
- Don't expose server filesystem paths in API responses
- Download must re-check authorization

---

### E) Tutor Profiles & Directory
Tutors need a way to present themselves so parents can find them.

A Tutor Profile minimally includes:
- `displayName`
- `qualifications` (free-text or a small list — e.g. "BSc Mathematics, NUS, 2022")
- `experiences` (free-text or a small list — e.g. "3 years teaching Sec 4 A-Math")
- `documents` (zero or more — e.g. scanned degree certs, MOE letters)
- timestamps

Must support:
- A **tutor** can create and edit **their own** profile
- A **tutor** can upload supporting documents to their own profile (reuse the upload mechanism from section D)
- **Parents** can browse a **Tutor Directory**:
  - paginated list of tutor profiles
  - search by name (and optionally by qualification/experience keyword)
- **Parents** can view any tutor's profile detail page

Authorization rules:
- Only the owning tutor can edit their profile or upload/delete its documents
- Any authenticated parent can view the directory and any tutor's profile
- Tutors should not be able to view other tutors' profiles (or, if you allow it, explain why — both are defensible)

Keep it simple: no ratings, reviews, or messaging needed. Just enough to find a tutor and read their background.

---

## What We Will Assess

### 1) Robustness & Stability
- Loading / empty / error / retry states handled consistently
- Graceful handling of edge cases and unexpected API responses
- Clear user-friendly error messages (no sensitive leaks)

### 2) Security Fundamentals
- Server-side authorization enforced (cases, documents, and tutor profile edits)
- Safe file upload / download handling
- Sensible auth / session implementation

### 3) API & Documentation Quality
- Clean endpoint design and predictable semantics
- **Swagger / OpenAPI completeness and accuracy**
- Clear documentation and readable code

### 4) UI
- Usable and reasonably consistent — we're not grading aesthetics
- No broken layouts or unfinished screens that block the flows above

### 5) Communication (Video walkthrough)
- Clarity of how you explain the system
- Honest discussion of tradeoffs and what you'd improve

---

## Stretch Goals (Optional — bonus, not required)
These are not required to pass, but they tell us something about how you think at the senior end.

- A **paywall** behavior somewhere sensible (e.g. tutors can only respond to N cases until they "subscribe" — a fake button is fine, no real Stripe needed).
- **SMS or email OTP** as an alternative login.
- A small **AI-assisted feature** (e.g. suggest a case title from a freeform description, or surface a "best-match" tutor — any LLM API or stub is fine).
- **E2E test** (Playwright preferred) covering one happy path.

Pick at most one. Don't sacrifice the core requirements for these.

---

## Deliverables
Please provide:
- **Repo link**
- **Deployment URL**
- **Swagger / OpenAPI docs URL**
- **Demo credentials** (or instructions to use seeded users)
- **Video walkthrough link** (unlisted YouTube / Loom / Drive — viewable without login preferred)

---

## Notes
We're not looking for perfection — focus on:
- correctness under edge cases
- clear security thinking
- maintainable architecture
- strong documentation and developer experience
- a video that helps us understand how you think