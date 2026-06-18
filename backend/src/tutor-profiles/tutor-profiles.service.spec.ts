import { NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { TutorProfilesService } from "./tutor-profiles.service";

const parent: AuthenticatedUser = { id: "p1", role: Role.PARENT, jti: "j" };
const tutor: AuthenticatedUser = { id: "t1", role: Role.TUTOR, jti: "j" };
const otherTutor: AuthenticatedUser = { id: "t2", role: Role.TUTOR, jti: "j" };

const profile = { id: "prof-1", userId: "t1", displayName: "Jane" };

function makePrisma() {
  return {
    tutorProfile: { upsert: vi.fn(), findUnique: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe("TutorProfilesService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TutorProfilesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    // biome-ignore lint/suspicious/noExplicitAny: test double
    service = new TutorProfilesService(prisma as any);
  });

  it("upserts the caller's own profile keyed by userId", async () => {
    prisma.tutorProfile.upsert.mockResolvedValue(profile);
    await service.upsertOwn(tutor, {
      displayName: "Jane",
      qualifications: [],
      experiences: [],
    });
    expect(prisma.tutorProfile.upsert.mock.calls[0][0].where).toEqual({ userId: "t1" });
  });

  it("404s getOwn when the tutor has no profile", async () => {
    prisma.tutorProfile.findUnique.mockResolvedValue(null);
    await expect(service.getOwn(tutor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets a parent view any profile", async () => {
    prisma.tutorProfile.findUnique.mockResolvedValue(profile);
    await expect(service.getById(parent, "prof-1")).resolves.toEqual(profile);
  });

  it("lets a tutor view their own profile", async () => {
    prisma.tutorProfile.findUnique.mockResolvedValue(profile);
    await expect(service.getById(tutor, "prof-1")).resolves.toEqual(profile);
  });

  it("404s when a tutor tries to view another tutor's profile (D9)", async () => {
    prisma.tutorProfile.findUnique.mockResolvedValue(profile);
    await expect(service.getById(otherTutor, "prof-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("builds a case-insensitive name search for the directory", async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listDirectory({ page: 1, pageSize: 20, q: "jan" });
    const where = prisma.tutorProfile.findMany.mock.calls[0][0].where;
    expect(where.displayName).toEqual({ contains: "jan", mode: "insensitive" });
  });
});
