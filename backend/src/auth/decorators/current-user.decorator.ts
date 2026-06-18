import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth.types";

/** Inject the authenticated user attached by {@link JwtAuthGuard}. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
