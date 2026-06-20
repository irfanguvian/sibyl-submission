import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CaseStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CaseAccessService } from "./case-access.service";

const parent: AuthenticatedUser = { id: "parent-1", role: Role.PARENT, jti: "j" };
const otherParent: AuthenticatedUser = { id: "parent-2", role: Role.PARENT, jti: "j" };
const tutor: AuthenticatedUser = { id: "tutor-1", role: Role.TUTOR, jti: "j" };
const tutor2: AuthenticatedUser = { id: "tutor-2", role: Role.TUTOR, jti: "j" };

function makePrisma() {
  return {
    case: { findUnique: vi.fn() },
    caseInvite: { findUnique: vi.fn() },
  };
}

const ownedCase = {
  id: "case-1",
  ownerId: "parent-1",
  status: CaseStatus.OPEN,
  matchedTutorId: null,
};

describe("CaseAccessService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: CaseAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    // biome-ignore lint/suspicious/noExplicitAny: test double
    service = new CaseAccessService(prisma as any);
  });

  describe("getViewableCase", () => {
    it("404s when the case does not exist", async () => {
      prisma.case.findUnique.mockResolvedValue(null);
      await expect(service.getViewableCase(parent, "x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets the owning parent view their case", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      await expect(service.getViewableCase(parent, "case-1")).resolves.toEqual(ownedCase);
    });

    it("404s for a parent viewing someone else's case (no existence leak)", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      await expect(service.getViewableCase(otherParent, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("lets an invited tutor view the case", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getViewableCase(tutor, "case-1")).resolves.toEqual(ownedCase);
    });

    it("404s for an uninvited tutor", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      prisma.caseInvite.findUnique.mockResolvedValue(null);
      await expect(service.getViewableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("lets the matched tutor view a MATCHED case", async () => {
      const c = { ...ownedCase, status: CaseStatus.MATCHED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getViewableCase(tutor, "case-1")).resolves.toEqual(c);
    });

    it("404s for an invited-but-unpicked tutor once the case is matched", async () => {
      const c = { ...ownedCase, status: CaseStatus.MATCHED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-2" });
      await expect(service.getViewableCase(tutor2, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("lets the matched tutor view a CLOSED case", async () => {
      const c = { ...ownedCase, status: CaseStatus.CLOSED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getViewableCase(tutor, "case-1")).resolves.toEqual(c);
    });
  });

  describe("getEditableCase", () => {
    it("lets the owner edit", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      await expect(service.getEditableCase(parent, "case-1")).resolves.toEqual(ownedCase);
    });

    it("403s for an invited tutor trying to edit", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getEditableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("404s for an uninvited tutor trying to edit (still hidden)", async () => {
      prisma.case.findUnique.mockResolvedValue(ownedCase);
      prisma.caseInvite.findUnique.mockResolvedValue(null);
      await expect(service.getEditableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("getUploadableCase", () => {
    it("OPEN + parent owner → allowed", async () => {
      const c = { ...ownedCase, status: CaseStatus.OPEN, matchedTutorId: null };
      prisma.case.findUnique.mockResolvedValue(c);
      await expect(service.getUploadableCase(parent, "case-1")).resolves.toEqual(c);
    });

    it("OPEN + invited tutor → allowed", async () => {
      const c = { ...ownedCase, status: CaseStatus.OPEN, matchedTutorId: null };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getUploadableCase(tutor, "case-1")).resolves.toEqual(c);
    });

    it("MATCHED + matched tutor → allowed", async () => {
      const c = { ...ownedCase, status: CaseStatus.MATCHED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getUploadableCase(tutor, "case-1")).resolves.toEqual(c);
    });

    it("MATCHED + other invited tutor → 404 (case no longer visible to them)", async () => {
      const c = { ...ownedCase, status: CaseStatus.MATCHED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      // tutor2 is invited but is not the matched tutor — matched cases are hidden.
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-2" });
      await expect(service.getUploadableCase(tutor2, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("CLOSED + owner → 403 (closed cases accept no uploads)", async () => {
      const c = { ...ownedCase, status: CaseStatus.CLOSED, matchedTutorId: null };
      prisma.case.findUnique.mockResolvedValue(c);
      await expect(service.getUploadableCase(parent, "case-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("CLOSED + invited-but-unpicked tutor → 404 (case no longer visible)", async () => {
      const c = { ...ownedCase, status: CaseStatus.CLOSED, matchedTutorId: null };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getUploadableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("CLOSED + matched tutor → 403 (closed cases accept no uploads)", async () => {
      const c = { ...ownedCase, status: CaseStatus.CLOSED, matchedTutorId: "tutor-1" };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue({ id: "inv-1" });
      await expect(service.getUploadableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("non-viewer (uninvited tutor) → 404 (existence not leaked)", async () => {
      const c = { ...ownedCase, status: CaseStatus.OPEN, matchedTutorId: null };
      prisma.case.findUnique.mockResolvedValue(c);
      prisma.caseInvite.findUnique.mockResolvedValue(null);
      await expect(service.getUploadableCase(tutor, "case-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
