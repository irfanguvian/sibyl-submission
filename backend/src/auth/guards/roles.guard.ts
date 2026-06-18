import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth.types";
import { ROLES_KEY } from "../decorators/roles.decorator";

/** Enforces {@link Roles} metadata. Runs after {@link JwtAuthGuard}. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
