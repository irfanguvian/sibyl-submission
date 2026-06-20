// Local API contract types.
//
// The authoritative endpoint contract is generated from the backend's OpenAPI
// document (`pnpm gen:types` -> `src/lib/api-types.gen.ts`) once the backend is
// running. The hand-maintained primitives below cover cross-cutting shapes that
// are stable across phases (roles, pagination envelope).

export type Role = "PARENT" | "TUTOR";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export type PaginatedMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type CaseStatus = "OPEN" | "MATCHED" | "CLOSED";

export type Case = {
  id: string;
  title: string;
  subject: string;
  level: string;
  location: string;
  budgetPerHour: number;
  description?: string | null;
  status: CaseStatus;
  ownerId: string;
  matchedTutorId?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A tutor currently invited to a case (GET /cases/:id/invites). */
export type InvitedTutor = {
  tutorId: string;
  displayName: string;
  qualifications: string[];
};

/** An AI-suggested (mock) tutor match (GET /cases/:id/recommendations). */
export type Recommendation = {
  tutorId: string;
  displayName: string;
  qualifications: string[];
  score: number;
  alreadyInvited: boolean;
};

export type TutorProfile = {
  id: string;
  userId: string;
  displayName: string;
  qualifications: string[];
  experiences: string[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentMeta = {
  id: string;
  originalName: string;
  size: number;
  mime: string;
  caseId: string | null;
  createdAt: string;
  // Uploader identity exposed by the backend DocumentResponseDto.
  // `uploadedById` identifies the account; `uploaderName` is the display name
  // (tutor profile display name, or the email fallback) used for the per-row tag.
  uploadedById?: string | null;
  uploaderName?: string;
};
