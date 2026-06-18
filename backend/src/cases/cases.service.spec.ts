import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CasesService } from "./cases.service";
import type { ListCasesQueryDto } from "./dto/list-cases-query.dto";

const parent: AuthenticatedUser = { id: "parent-1", role: Role.PARENT, jti: "j" };
const tutor: AuthenticatedUser = { id: "tutor-1", role: Role.TUTOR, jti: "j" };

function makePrisma() {
  return {
    case: { create: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    caseInvite: { upsert: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
}

const access = {
  getViewableCase: vi.fn(),
  getEditableCase: vi.fn(),
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
    service = new CasesService(prisma as any, access as any);
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
});
