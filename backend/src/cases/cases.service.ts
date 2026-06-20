import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Case, type CaseInvite, CaseStatus, type Prisma, Role } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { type Paginated, pageSkip, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CaseAccessService } from "./case-access.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { InvitedTutorDto } from "./dto/invited-tutor.dto";
import type { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import type { RecommendationDto } from "./dto/recommendation.dto";
import type { UpdateCaseDto } from "./dto/update-case.dto";
import { RecommendationsService } from "./recommendations.service";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly recommendations: RecommendationsService,
  ) {}

  create(user: AuthenticatedUser, dto: CreateCaseDto): Promise<Case> {
    return this.prisma.case.create({
      data: { ...dto, ownerId: user.id },
    });
  }

  findOne(user: AuthenticatedUser, caseId: string): Promise<Case> {
    return this.access.getViewableCase(user, caseId);
  }

  async update(user: AuthenticatedUser, caseId: string, dto: UpdateCaseDto): Promise<Case> {
    await this.access.getEditableCase(user, caseId);
    return this.prisma.case.update({ where: { id: caseId }, data: dto });
  }

  async list(user: AuthenticatedUser, query: ListCasesQueryDto): Promise<Paginated<Case>> {
    const where: Prisma.CaseWhereInput =
      user.role === Role.PARENT
        ? { ownerId: user.id }
        : {
            invites: { some: { tutorId: user.id } },
            // Tutors see OPEN invites; once matched/closed, only the picked tutor.
            OR: [{ status: CaseStatus.OPEN }, { matchedTutorId: user.id }],
          };

    if (query.q) {
      where.title = { contains: query.q, mode: "insensitive" };
    }
    if (query.subject) {
      where.subject = query.subject;
    }
    if (query.level) {
      where.level = query.level;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.case.count({ where }),
      this.prisma.case.findMany({
        where,
        skip: pageSkip(query.page, query.pageSize),
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return paginate(data, total, query.page, query.pageSize);
  }

  async invite(user: AuthenticatedUser, caseId: string, tutorId: string): Promise<CaseInvite> {
    await this.access.getEditableCase(user, caseId);

    const tutor = await this.prisma.user.findUnique({ where: { id: tutorId } });
    if (!tutor) {
      throw new NotFoundException("Tutor not found");
    }
    if (tutor.role !== Role.TUTOR) {
      throw new BadRequestException("Only tutors can be invited");
    }

    // Idempotent: re-inviting an already-invited tutor returns the existing row.
    return this.prisma.caseInvite.upsert({
      where: { caseId_tutorId: { caseId, tutorId } },
      update: {},
      create: { caseId, tutorId },
    });
  }

  async revokeInvite(user: AuthenticatedUser, caseId: string, tutorId: string): Promise<void> {
    await this.access.getEditableCase(user, caseId);
    const result = await this.prisma.caseInvite.deleteMany({ where: { caseId, tutorId } });
    if (result.count === 0) {
      throw new NotFoundException("Invite not found");
    }
  }

  async listInvites(user: AuthenticatedUser, caseId: string): Promise<InvitedTutorDto[]> {
    await this.access.getEditableCase(user, caseId);

    const invites = await this.prisma.caseInvite.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      select: {
        tutorId: true,
        tutor: {
          select: {
            email: true,
            tutorProfile: { select: { displayName: true, qualifications: true } },
          },
        },
      },
    });

    return invites.map((invite) => ({
      tutorId: invite.tutorId,
      displayName: invite.tutor.tutorProfile?.displayName ?? invite.tutor.email ?? "",
      qualifications: invite.tutor.tutorProfile?.qualifications ?? [],
    }));
  }

  async acceptTutor(user: AuthenticatedUser, caseId: string, tutorId: string): Promise<Case> {
    const found = await this.access.getEditableCase(user, caseId);

    const invite = await this.prisma.caseInvite.findUnique({
      where: { caseId_tutorId: { caseId, tutorId } },
    });
    if (!invite) {
      throw new BadRequestException("Tutor is not invited to this case");
    }

    if (found.matchedTutorId && found.matchedTutorId !== tutorId) {
      throw new ConflictException("Case already has a matched tutor");
    }

    // Idempotent: re-accepting the same tutor returns the already-matched case.
    if (found.matchedTutorId === tutorId && found.status === CaseStatus.MATCHED) {
      return found;
    }

    return this.prisma.case.update({
      where: { id: caseId },
      data: { matchedTutorId: tutorId, status: CaseStatus.MATCHED },
    });
  }

  async recommend(user: AuthenticatedUser, caseId: string): Promise<RecommendationDto[]> {
    const found = await this.access.getEditableCase(user, caseId);
    return this.recommendations.recommend(found);
  }
}
