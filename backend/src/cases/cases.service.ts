import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type Case, type CaseInvite, type Prisma, Role } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { type Paginated, pageSkip, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CaseAccessService } from "./case-access.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import type { UpdateCaseDto } from "./dto/update-case.dto";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
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
        : { invites: { some: { tutorId: user.id } } };

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
}
