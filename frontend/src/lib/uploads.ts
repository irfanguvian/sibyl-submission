// Client-side upload constraints — mirror the backend allowlist
// (`backend/src/documents/mime.ts`) and `MAX_UPLOAD_BYTES` (default 10 MB).
// These are a UX convenience: the server re-validates by magic bytes and size.

/** Max upload size in bytes (10 MB) — matches backend MAX_UPLOAD_BYTES default. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Extensions accepted by the backend mime allowlist. */
export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "docx"] as const;

/** Value for an <input type="file"> `accept` attribute. */
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

/** Human-readable hint used by the dropzone. */
export const UPLOAD_HINT = "PDF, PNG, JPG or DOCX · up to 10 MB";

export type UploadValidation = { ok: true } | { ok: false; error: string };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Reject unsupported types or oversized files before hitting the API. */
export function validateUploadFile(file: File): UploadValidation {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, error: "Unsupported file type — use PDF, PNG, JPG or DOCX." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large — the limit is 10 MB." };
  }
  return { ok: true };
}
