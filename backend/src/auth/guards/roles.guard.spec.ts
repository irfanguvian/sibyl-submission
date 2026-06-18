import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RolesGuard } from "./roles.guard";

function makeContext(user?: { role: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const reflector = { getAllAndOverride: vi.fn() };
  // biome-ignore lint/suspicious/noExplicitAny: test doubles
  const guard = new RolesGuard(reflector as any);

  beforeEach(() => vi.clearAllMocks());

  it("allows routes with no @Roles metadata", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: "PARENT" }))).toBe(true);
  });

  it("allows a user whose role matches", () => {
    reflector.getAllAndOverride.mockReturnValue(["PARENT"]);
    expect(guard.canActivate(makeContext({ role: "PARENT" }))).toBe(true);
  });

  it("forbids a user whose role does not match", () => {
    reflector.getAllAndOverride.mockReturnValue(["PARENT"]);
    expect(() => guard.canActivate(makeContext({ role: "TUTOR" }))).toThrow(ForbiddenException);
  });

  it("forbids when there is no authenticated user", () => {
    reflector.getAllAndOverride.mockReturnValue(["PARENT"]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
