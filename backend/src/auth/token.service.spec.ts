import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenService } from "./token.service";

type MockPrisma = {
  oauthAccessToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  oauthRefreshToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): MockPrisma {
  return {
    oauthAccessToken: {
      create: vi.fn().mockResolvedValue({ id: "acc-1" }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: "acc-1" }]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    oauthRefreshToken: {
      create: vi.fn().mockResolvedValue({ id: "ref-1" }),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
}

const jwt = {
  signAsync: vi.fn().mockResolvedValue("signed.jwt.token"),
  verifyAsync: vi.fn(),
};

const config = {
  get: vi.fn((key: string) => (key === "ACCESS_TOKEN_TTL" ? 900 : 604800)),
};

function makeService(prisma: MockPrisma): TokenService {
  // biome-ignore lint/suspicious/noExplicitAny: test doubles
  return new TokenService(prisma as any, jwt as any, config as any);
}

describe("TokenService", () => {
  let prisma: MockPrisma;
  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt.signAsync.mockResolvedValue("signed.jwt.token");
    config.get.mockImplementation((key: string) => (key === "ACCESS_TOKEN_TTL" ? 900 : 604800));
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it("issuePair signs a JWT and persists access + refresh rows", async () => {
    const pair = await service.issuePair({ id: "u1", role: "PARENT" });

    expect(pair.accessToken).toBe("signed.jwt.token");
    expect(pair.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(pair.expiresIn).toBe(900);
    expect(prisma.oauthAccessToken.create).toHaveBeenCalledOnce();
    expect(prisma.oauthRefreshToken.create).toHaveBeenCalledOnce();
  });

  it("verifyAccess returns the principal for a valid, unrevoked token", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: "u1", role: "TUTOR", jti: "jti-1" });
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const user = await service.verifyAccess("token");
    expect(user).toEqual({ id: "u1", role: "TUTOR", jti: "jti-1" });
  });

  it("verifyAccess rejects an invalid JWT signature", async () => {
    jwt.verifyAsync.mockRejectedValue(new Error("bad sig"));
    await expect(service.verifyAccess("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifyAccess rejects a revoked token", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: "u1", role: "PARENT", jti: "jti-1" });
    prisma.oauthAccessToken.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.verifyAccess("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifyAccess rejects when the DB row is missing", async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: "u1", role: "PARENT", jti: "jti-1" });
    prisma.oauthAccessToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyAccess("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotate issues a new pair for a valid refresh token", async () => {
    prisma.oauthRefreshToken.findUnique.mockResolvedValue({
      accessTokenId: "acc-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      accessToken: { userId: "u1", user: { role: "PARENT" } },
    });

    const pair = await service.rotate("raw-refresh");
    expect(pair.accessToken).toBe("signed.jwt.token");
    // old pair revoked (transaction) + new pair issued (create x2)
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.oauthAccessToken.create).toHaveBeenCalledOnce();
  });

  it("rotate revokes the whole family when a revoked refresh token is reused", async () => {
    prisma.oauthRefreshToken.findUnique.mockResolvedValue({
      accessTokenId: "acc-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      accessToken: { userId: "u1", user: { role: "PARENT" } },
    });

    await expect(service.rotate("raw-refresh")).rejects.toBeInstanceOf(UnauthorizedException);
    // revokeFamily ran (findMany + transaction), but no new pair was issued
    expect(prisma.oauthAccessToken.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { id: true },
    });
    expect(prisma.oauthAccessToken.create).not.toHaveBeenCalled();
  });

  it("rotate rejects an unknown refresh token", async () => {
    prisma.oauthRefreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate("nope")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotate rejects an expired refresh token", async () => {
    prisma.oauthRefreshToken.findUnique.mockResolvedValue({
      accessTokenId: "acc-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      accessToken: { userId: "u1", user: { role: "PARENT" } },
    });
    await expect(service.rotate("raw-refresh")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokeByAccessJti revokes the matching pair when found", async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue({ id: "acc-1" });
    await service.revokeByAccessJti("jti-1");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("revokeByAccessJti is a no-op when no token matches", async () => {
    prisma.oauthAccessToken.findUnique.mockResolvedValue(null);
    await service.revokeByAccessJti("jti-x");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
