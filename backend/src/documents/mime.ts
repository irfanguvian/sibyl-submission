/**
 * Magic-byte MIME sniffing — never trust the client-provided extension or
 * Content-Type. Only the allowlisted types are accepted; anything else (including
 * an .exe renamed to .pdf) returns null and is rejected with 415.
 */

export const ALLOWED_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type AllowedMime = (typeof ALLOWED_MIME)[keyof typeof ALLOWED_MIME];

function startsWith(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) {
    return false;
  }
  return bytes.every((b, i) => buf[i] === b);
}

/**
 * Returns the canonical MIME for an allowed file, or null if the magic bytes
 * don't match a supported type. DOCX is a ZIP container, so the ZIP signature is
 * accepted as a DOCX candidate (the allowlist's purpose is to reject executables
 * and other unsupported binaries, not to deeply validate Office internals).
 */
export function detectAllowedMime(buf: Buffer): AllowedMime | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) {
    return ALLOWED_MIME.pdf; // %PDF
  }
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ALLOWED_MIME.png;
  }
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return ALLOWED_MIME.jpg;
  }
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return ALLOWED_MIME.docx; // PK ZIP container
  }
  return null;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
const UNSAFE_FILENAME_CHARS = /[\x00-\x1f<>:"/\\|?*]/g;
const PATH_PREFIX = /^.*[/\\]/;

/** Strip any path components / control chars from a client-supplied filename. */
export function safeFilename(name: string): string {
  const base = name.replace(PATH_PREFIX, "").replace(UNSAFE_FILENAME_CHARS, "_");
  const trimmed = base.trim().slice(0, 255);
  return trimmed.length > 0 ? trimmed : "file";
}
