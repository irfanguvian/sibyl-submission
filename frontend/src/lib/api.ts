import type { Case, CaseStatus, DocumentMeta, Paginated, TutorProfile } from "./api-types";

// Everything goes through the authenticated BFF proxy, which attaches the bearer
// token from the httpOnly cookie and silently refreshes on 401.
const PROXY = "/api/proxy";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PROXY}${path}`, {
    credentials: "include",
    ...init,
    headers: { ...init?.headers },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ── Cases ────────────────────────────────────────────────────────────────────

export type CaseListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  subject?: string;
  level?: string;
  status?: CaseStatus;
};

export type CaseInput = {
  title: string;
  subject: string;
  level: string;
  location: string;
  budgetPerHour: number;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const casesApi = {
  list: (params: CaseListParams = {}) => api<Paginated<Case>>(`/cases${toQuery(params)}`),
  get: (id: string) => api<Case>(`/cases/${id}`),
  create: (input: CaseInput) => api<Case>("/cases", jsonInit("POST", input)),
  update: (id: string, input: Partial<CaseInput & { status: CaseStatus }>) =>
    api<Case>(`/cases/${id}`, jsonInit("PATCH", input)),
  invite: (id: string, tutorId: string) =>
    api<{ caseId: string; tutorId: string }>(`/cases/${id}/invites`, jsonInit("POST", { tutorId })),
  revokeInvite: (id: string, tutorId: string) =>
    api<void>(`/cases/${id}/invites/${tutorId}`, { method: "DELETE" }),
  listDocuments: (id: string) => api<DocumentMeta[]>(`/cases/${id}/documents`),
  downloadUrl: (documentId: string) => `${PROXY}/documents/${documentId}/download`,
};

// ── Tutor profiles / directory ─────────────────────────────────────────────--

export type ProfileInput = {
  displayName: string;
  qualifications: string[];
  experiences: string[];
};

export const tutorsApi = {
  directory: (params: { page?: number; pageSize?: number; q?: string } = {}) =>
    api<Paginated<TutorProfile>>(`/tutor-profiles${toQuery(params)}`),
  get: (id: string) => api<TutorProfile>(`/tutor-profiles/${id}`),
  getOwn: () => api<TutorProfile>("/tutor-profiles/me"),
  upsertOwn: (input: ProfileInput) =>
    api<TutorProfile>("/tutor-profiles/me", jsonInit("PUT", input)),
  listDocuments: (id: string) => api<DocumentMeta[]>(`/tutor-profiles/${id}/documents`),
};

// ── Uploads (multipart) ──────────────────────────────────────────────────────

export async function uploadDocument(path: string, file: File): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("file", file);
  return api<DocumentMeta>(path, { method: "POST", body: form });
}
