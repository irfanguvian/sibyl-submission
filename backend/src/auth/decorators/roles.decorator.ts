import { SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

export const ROLES_KEY = "roles";

/** Restrict a route to the given roles. Enforced by {@link RolesGuard}. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
