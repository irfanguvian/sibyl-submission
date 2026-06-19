import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CaseStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CasesService } from "./cases.service";
import type { ListCasesQueryDto } from "./dto/list-cases-query.dto";

const parent: AuthenticatedUser = { id: "parent-1", role: Role.PARENT, jti: "j" };
const tutor: AuthenticatedUser = { id: "tutor-1", role: Role.TUTOR, jti: "j" };

function makePrisma() {
  return {
    case: { create: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    caseInvite: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
}

const access = {
  getViewableCase: vi.fn(),
  getEditableCase: vi.fn(),
};

const recommendations = {
  recommend: vi.fn(),
};

function baseQuery(overrides: Partial<ListCasesQueryDto> = {}): ListCasesQueryDto {
  return { page: 1, pageSize: 20, ...overrides } as ListCasesQueryDto;
}

describe("CasesService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: CasesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    // biome-ignore lint/suspicious/noExplicitAny: test doubles
    service = new CasesService(prisma as any, access as any, recommendations as any);
  });

  it("scopes a parent's list to their owned cases", async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.list(parent, baseQuery());
    const countArg = prisma.case.count.mock.calls[0][0];
    expect(countArg.where).toEqual({ ownerId: "parent-1" });
  });

  it("scopes a tutor's list to invited cases and applies filters", async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.list(tutor, baseQuery({ q: "math", subject: "Maths", status: "OPEN" as never }));
    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(where.invites).toEqual({ some: { tutorId: "tutor-1" } });
    expect(where.title).toEqual({ contains: "math", mode: "insensitive" });
    expect(where.subject).toBe("Maths");
    expect(where.status).toBe("OPEN");
  });

  it("returns honest empty meta for an out-of-range page", async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    const result = await service.list(parent, baseQuery({ page: 99 }));
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ page: 99, pageSize: 20, total: 0, totalPages: 0 });
  });

  it("rejects inviting a non-tutor user", async () => {
    access.getEditableCase.mockResolvedValue({ id: "case-1" });
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: Role.PARENT });
    await expect(service.invite(parent, "case-1", "u2")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("404s when inviting an unknown user", async () => {
    access.getEditableCase.mockResolvedValue({ id: "case-1" });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.invite(parent, "case-1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("upserts a valid tutor invite idempotently", async () => {
    access.getEditableCase.mockResolvedValue({ id: "case-1" });
    prisma.user.findUnique.mockResolvedValue({ id: "tutor-1", role: Role.TUTOR });
    prisma.caseInvite.upsert.mockResolvedValue({ caseId: "case-1", tutorId: "tutor-1" });
    await service.invite(parent, "case-1", "tutor-1");
    expect(prisma.caseInvite.upsert).toHaveBeenCalledOnce();
  });

  it("404s when revoking a non-existent invite", async () => {
    access.getEditableCase.mockResolvedValue({ id: "case-1" });
    prisma.caseInvite.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeInvite(parent, "case-1", "tutor-9")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("passes budgetPerHour and description through to the create call", async () => {
    prisma.case.create.mockResolvedValue({ id: "case-1" });
    await service.create(parent, {
      title: "Algebra",
      subject: "Maths",
      level: "GCSE",
      location: "London",
      budgetPerHour: 55,
      description: "Exam technique focus",
      // biome-ignore lint/suspicious/noExplicitAny: minimal DTO shape for the test
    } as any);
    const data = prisma.case.create.mock.calls[0][0].data;
    expect(data.budgetPerHour).toBe(55);
    expect(data.description).toBe("Exam technique focus");
    expect(data.ownerId).toBe("parent-1");
  });

  describe("listInvites", () => {
    it("delegates ownership enforcement to the access service", async () => {
      access.getEditableCase.mockResolvedValue({ id: "case-1" });
      prisma.caseInvite.findMany.mockResolvedValue([]);
      await service.listInvites(parent, "case-1");
      expect(access.getEditableCase).toHaveBeenCalledWith(parent, "case-1");
    });

    it("propagates the access error when the caller is not the owner", async () => {
      access.getEditableCase.mockRejectedValue(new NotFoundException());
      await expect(service.listInvites(parent, "case-x")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.caseInvite.findMany).not.toHaveBeenCalled();
    });

    it("maps invites to display name with email/empty fallbacks", async () => {
      access.getEditableCase.mockResolvedValue({ id: "case-1" });
      prisma.caseInvite.findMany.mockResolvedValue([
        {
          tutorId: "t1",
          tutor: {
            email: "t1@example.com",
            tutorProfile: { displayName: "Tina", qualifications: ["BSc Maths"] },
          },
        },
        {
          tutorId: "t2",
          tutor: { email: "t2@example.com", tutorProfile: null },
        },
      ]);
      const result = await service.listInvites(parent, "case-1");
      expect(result).toEqual([
        { tutorId: "t1", displayName: "Tina", qualifications: ["BSc Maths"] },
        { tutorId: "t2", displayName: "t2@example.com", qualifications: [] },
      ]);
    });
  });

  describe("acceptTutor", () => {
    it("400s when the tutor is not invited to the case", async () => {
      access.getEditableCase.mockResolvedValue({ id: "case-1", matchedTutorId: null });
      prisma.caseInvite.findUnique.mockResolvedValue(null);
      await expect(service.acceptTutor(parent, "case-1", "tutor-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it("409s when the case is already matched to a different tutor", async () => {
      access.getEditableCase.mockResolvedValue({
        id: "case-1",
        matchedTutorId: "other-tutor",
        status: CaseStatus.MATCHED,
      });
      prisma.caseInvite.findUnique.mockResolvedValue({ caseId: "case-1", tutorId: "tutor-1" });
      await expect(service.acceptTutor(parent, "case-1", "tutor-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it("is idempotent when re-accepting the already-matched tutor", async () => {
      const matched = {
        id: "case-1",
        matchedTutorId: "tutor-1",
        status: CaseStatus.MATCHED,
      };
      access.getEditableCase.mockResolvedValue(matched);
      prisma.caseInvite.findUnique.mockResolvedValue({ caseId: "case-1", tutorId: "tutor-1" });
      const result = await service.acceptTutor(parent, "case-1", "tutor-1");
      expect(result).toBe(matched);
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it("matches an invited tutor: sets status MATCHED and matchedTutorId", async () => {
      access.getEditableCase.mockResolvedValue({
        id: "case-1",
        matchedTutorId: null,
        status: CaseStatus.OPEN,
      });
      prisma.caseInvite.findUnique.mockResolvedValue({ caseId: "case-1", tutorId: "tutor-1" });
      prisma.case.update.mockResolvedValue({
        id: "case-1",
        matchedTutorId: "tutor-1",
        status: CaseStatus.MATCHED,
      });
      const result = await service.acceptTutor(parent, "case-1", "tutor-1");
      const updateArg = prisma.case.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: "case-1" });
      expect(updateArg.data).toEqual({ matchedTutorId: "tutor-1", status: CaseStatus.MATCHED });
      expect(result.matchedTutorId).toBe("tutor-1");
      expect(result.status).toBe(CaseStatus.MATCHED);
    });
  });

  it("recommend delegates to the access guard then the recommendations engine", async () => {
    const found = { id: "case-1", subject: "Maths" };
    access.getEditableCase.mockResolvedValue(found);
    recommendations.recommend.mockResolvedValue([{ tutorId: "t1" }]);
    const result = await service.recommend(parent, "case-1");
    expect(access.getEditableCase).toHaveBeenCalledWith(parent, "case-1");
    expect(recommendations.recommend).toHaveBeenCalledWith(found);
    expect(result).toEqual([{ tutorId: "t1" }]);
  });
});
