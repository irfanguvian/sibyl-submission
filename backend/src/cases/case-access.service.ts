import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type Case, Role } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The single choke point for case authorization (D8).
 *
 * Visibility rules:
 *   - PARENT  → only cases they own.
 *   - TUTOR   → only cases they have been invited to.
 *
 * To avoid leaking the existence of cases a user may not see, anything not
 * visible returns **404**. Editing is owner-only: a visible-but-not-owner case
 * (i.e. an invited tutor) returns **403**.
 */
@Injectable()
export class CaseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Return the case if the user may view it, else throw 404. */
  async getViewableCase(user: AuthenticatedUser, caseId: string): Promise<Case> {
    const found = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!found) {
      throw new NotFoundException("Case not found");
    }

    if (user.role === Role.PARENT) {
      if (found.ownerId !== user.id) {
        throw new NotFoundException("Case not found");
      }
      return found;
    }

    // TUTOR — must be invited.
    const invite = await this.prisma.caseInvite.findUnique({
      where: { caseId_tutorId: { caseId, tutorId: user.id } },
    });
    if (!invite) {
      throw new NotFoundException("Case not found");
    }
    return found;
  }

  /** Return the case if the user may edit it (owner only), else 404/403. */
  async getEditableCase(user: AuthenticatedUser, caseId: string): Promise<Case> {
    const found = await this.getViewableCase(user, caseId);
    const isOwner = user.role === Role.PARENT && found.ownerId === user.id;
    if (!isOwner) {
      // Visible (invited tutor) but not the owner.
      throw new ForbiddenException("You cannot modify this case");
    }
    return found;
  }
}
