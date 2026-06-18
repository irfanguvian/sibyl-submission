import { Injectable, NotFoundException } from "@nestjs/common";
import { type Prisma, Role, type TutorProfile } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { type Paginated, pageSkip, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import type { ListProfilesQueryDto } from "./dto/list-profiles-query.dto";
import type { UpsertProfileDto } from "./dto/upsert-profile.dto";

@Injectable()
export class TutorProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create or update the caller's own tutor profile. */
  upsertOwn(user: AuthenticatedUser, dto: UpsertProfileDto): Promise<TutorProfile> {
    return this.prisma.tutorProfile.upsert({
      where: { userId: user.id },
      update: dto,
      create: { ...dto, userId: user.id },
    });
  }

  async getOwn(user: AuthenticatedUser): Promise<TutorProfile> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      throw new NotFoundException("You have not created a tutor profile yet");
    }
    return profile;
  }

  /** Parent-only directory: paginated, name keyword search. */
  async listDirectory(query: ListProfilesQueryDto): Promise<Paginated<TutorProfile>> {
    const where: Prisma.TutorProfileWhereInput = query.q
      ? { displayName: { contains: query.q, mode: "insensitive" } }
      : {};

    const [total, data] = await this.prisma.$transaction([
      this.prisma.tutorProfile.count({ where }),
      this.prisma.tutorProfile.findMany({
        where,
        skip: pageSkip(query.page, query.pageSize),
        take: query.pageSize,
        orderBy: { displayName: "asc" },
      }),
    ]);

    return paginate(data, total, query.page, query.pageSize);
  }

  /** Parents may view any profile; tutors only their own (D9 — others hidden as 404). */
  async getById(user: AuthenticatedUser, id: string): Promise<TutorProfile> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException("Profile not found");
    }
    if (user.role === Role.TUTOR && profile.userId !== user.id) {
      throw new NotFoundException("Profile not found");
    }
    return profile;
  }
}
