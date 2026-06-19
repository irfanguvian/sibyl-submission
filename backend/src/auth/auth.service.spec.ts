import { ConflictException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { compare } from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

function makePrisma() {
  return {
    user: { findUnique: vi.fn(), create: vi.fn() },
    tutorProfile: { create: vi.fn().mockResolvedValue({ id: "prof-1" }) },
  };
}

const tokens = {
  issuePair: vi.fn(),
};

describe("AuthService.register", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    // biome-ignore lint/suspicious/noExplicitAny: test doubles
    service = new AuthService(prisma as any, tokens as any);
  });

  it("rejects a duplicate email with 409", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing", email: "dup@example.com" });
    await expect(
      service.register("dup@example.com", "password123", Role.PARENT),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", email: "p@example.com", role: Role.PARENT });

    await service.register("p@example.com", "password123", Role.PARENT);

    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.passwordHash).not.toBe("password123");
    expect(createData.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    await expect(compare("password123", createData.passwordHash)).resolves.toBe(true);
  });

  it("returns only the public id/email/role projection", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", email: "p@example.com", role: Role.PARENT });

    const result = await service.register("p@example.com", "password123", Role.PARENT);
    expect(result).toEqual({ id: "u1", email: "p@example.com", role: Role.PARENT });
    // The create call selects only public fields.
    expect(prisma.user.create.mock.calls[0][0].select).toEqual({
      id: true,
      email: true,
      role: true,
    });
  });

  it("does NOT bootstrap a tutor profile for a PARENT", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", email: "p@example.com", role: Role.PARENT });

    await service.register("p@example.com", "password123", Role.PARENT);
    expect(prisma.tutorProfile.create).not.toHaveBeenCalled();
  });

  it("bootstraps an empty tutor profile for a TUTOR registration", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u2", email: "t@example.com", role: Role.TUTOR });

    await service.register("t@example.com", "password123", Role.TUTOR);

    expect(prisma.tutorProfile.create).toHaveBeenCalledOnce();
    const profileData = prisma.tutorProfile.create.mock.calls[0][0].data;
    expect(profileData).toMatchObject({
      userId: "u2",
      qualifications: [],
      experiences: [],
    });
  });

  it("uses the supplied displayName for the tutor profile when provided", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u2", email: "t@example.com", role: Role.TUTOR });

    await service.register("t@example.com", "password123", Role.TUTOR, "Jane Doe");
    expect(prisma.tutorProfile.create.mock.calls[0][0].data.displayName).toBe("Jane Doe");
  });

  it("derives the tutor displayName from the email local-part when omitted", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u2", email: "jane@example.com", role: Role.TUTOR });

    await service.register("jane@example.com", "password123", Role.TUTOR);
    expect(prisma.tutorProfile.create.mock.calls[0][0].data.displayName).toBe("jane");
  });
});
