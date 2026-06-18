import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";

function makeContext(headers: Record<string, string>): {
  ctx: ExecutionContext;
  request: { headers: Record<string, string>; user?: unknown };
} {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe("JwtAuthGuard", () => {
  const tokenService = { verifyAccess: vi.fn() };
  const reflector = { getAllAndOverride: vi.fn() };
  // biome-ignore lint/suspicious/noExplicitAny: test doubles
  const guard = new JwtAuthGuard(tokenService as any, reflector as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows public routes without a token", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tokenService.verifyAccess).not.toHaveBeenCalled();
  });

  it("rejects when no bearer token is present", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a non-Bearer authorization scheme", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = makeContext({ authorization: "Basic abc" });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches the verified user for a valid token", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccess.mockResolvedValue({ id: "u1", role: "PARENT", jti: "j1" });
    const { ctx, request } = makeContext({ authorization: "Bearer good.token" });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tokenService.verifyAccess).toHaveBeenCalledWith("good.token");
    expect(request.user).toEqual({ id: "u1", role: "PARENT", jti: "j1" });
  });
});
