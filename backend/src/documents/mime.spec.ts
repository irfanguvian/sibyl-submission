import { describe, expect, it } from "vitest";
import { ALLOWED_MIME, detectAllowedMime, safeFilename } from "./mime";

function buf(...bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

describe("detectAllowedMime", () => {
  it("detects PDF", () => {
    expect(detectAllowedMime(buf(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe(ALLOWED_MIME.pdf);
  });

  it("detects PNG", () => {
    expect(detectAllowedMime(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      ALLOWED_MIME.png,
    );
  });

  it("detects JPEG", () => {
    expect(detectAllowedMime(buf(0xff, 0xd8, 0xff, 0xe0))).toBe(ALLOWED_MIME.jpg);
  });

  it("detects DOCX (zip container)", () => {
    expect(detectAllowedMime(buf(0x50, 0x4b, 0x03, 0x04))).toBe(ALLOWED_MIME.docx);
  });

  it("rejects an executable masquerading as a file (MZ header)", () => {
    expect(detectAllowedMime(buf(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
  });

  it("rejects arbitrary text", () => {
    expect(detectAllowedMime(Buffer.from("hello world"))).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(detectAllowedMime(Buffer.alloc(0))).toBeNull();
  });
});

describe("safeFilename", () => {
  it("strips unix path traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("strips windows path components", () => {
    expect(safeFilename("C:\\\\Users\\\\evil\\\\report.pdf")).toBe("report.pdf");
  });

  it("preserves a normal name with dots and digits", () => {
    expect(safeFilename("Algebra 101.pdf")).toBe("Algebra 101.pdf");
  });

  it("replaces forbidden characters", () => {
    expect(safeFilename('a<b>c:"d.pdf')).toBe("a_b_c__d.pdf");
  });

  it("falls back to 'file' for an empty result", () => {
    expect(safeFilename("/////")).toBe("file");
  });
});
