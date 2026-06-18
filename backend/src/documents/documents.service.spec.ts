import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { DocumentsService } from "./documents.service";

const user: AuthenticatedUser = { id: "u1", role: Role.PARENT, jti: "j" };
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: PDF,
    size: PDF.length,
    originalname: "notes.pdf",
    ...overrides,
  } as Express.Multer.File;
}

function makeDeps() {
  return {
    prisma: { document: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() } },
    storage: { put: vi.fn().mockResolvedValue(undefined), presignedGetUrl: vi.fn() },
    access: { getViewableCase: vi.fn().mockResolvedValue({ id: "case-1" }) },
    config: { get: vi.fn().mockReturnValue(10 * 1024 * 1024) },
  };
}

describe("DocumentsService", () => {
  let d: ReturnType<typeof makeDeps>;
  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    d = makeDeps();
    service = new DocumentsService(
      // biome-ignore lint/suspicious/noExplicitAny: test doubles
      d.prisma as any,
      // biome-ignore lint/suspicious/noExplicitAny: test doubles
      d.storage as any,
      // biome-ignore lint/suspicious/noExplicitAny: test doubles
      d.access as any,
      // biome-ignore lint/suspicious/noExplicitAny: test doubles
      d.config as any,
    );
  });

  describe("uploadToCase", () => {
    it("stores the object and persists sanitized metadata", async () => {
      d.prisma.document.create.mockResolvedValue({ id: "doc-1" });
      await service.uploadToCase(user, "case-1", file({ originalname: "../../evil.pdf" }));

      expect(d.storage.put).toHaveBeenCalledOnce();
      const createArg = d.prisma.document.create.mock.calls[0][0].data;
      expect(createArg.originalName).toBe("evil.pdf");
      expect(createArg.mime).toBe("application/pdf");
      expect(createArg.caseId).toBe("case-1");
      // storedKey is an opaque UUID, not derived from the filename
      expect(createArg.storedKey).not.toContain("evil");
    });

    it("404s (existence-safe) when the caller cannot view the case", async () => {
      d.access.getViewableCase.mockRejectedValue(new NotFoundException());
      await expect(service.uploadToCase(user, "case-x", file())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(d.storage.put).not.toHaveBeenCalled();
    });

    it("400s when no file is provided", async () => {
      await expect(service.uploadToCase(user, "case-1", undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("413s when the file exceeds the size limit", async () => {
      d.config.get.mockReturnValue(4);
      await expect(
        service.uploadToCase(user, "case-1", file({ size: 1000 })),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it("415s when the magic bytes are not an allowed type", async () => {
      const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      await expect(
        service.uploadToCase(user, "case-1", file({ buffer: exe, size: exe.length })),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(d.storage.put).not.toHaveBeenCalled();
    });
  });

  describe("getDownloadUrl", () => {
    it("re-checks case access and returns a presigned URL", async () => {
      d.prisma.document.findUnique.mockResolvedValue({ storedKey: "key-1", caseId: "case-1" });
      d.storage.presignedGetUrl.mockResolvedValue("https://signed.example/key-1");

      const url = await service.getDownloadUrl(user, "doc-1");
      expect(d.access.getViewableCase).toHaveBeenCalledWith(user, "case-1");
      expect(url).toBe("https://signed.example/key-1");
    });

    it("404s for a missing document", async () => {
      d.prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.getDownloadUrl(user, "missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("404s (existence-safe) when the case re-check fails", async () => {
      d.prisma.document.findUnique.mockResolvedValue({ storedKey: "k", caseId: "case-1" });
      d.access.getViewableCase.mockRejectedValue(new NotFoundException());
      await expect(service.getDownloadUrl(user, "doc-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(d.storage.presignedGetUrl).not.toHaveBeenCalled();
    });
  });
});
