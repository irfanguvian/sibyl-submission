import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CasesService } from "./cases.service";
import { CaseResponseDto, PaginatedCasesDto } from "./dto/case-response.dto";
import { CreateCaseDto } from "./dto/create-case.dto";
import { InviteDto } from "./dto/invite.dto";
import { ListCasesQueryDto } from "./dto/list-cases-query.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";

@ApiTags("cases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Post()
  @Roles(Role.PARENT)
  @ApiOperation({ summary: "Create a case (parent only)" })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiForbiddenResponse({ description: "Not a parent" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCaseDto,
  ): Promise<CaseResponseDto> {
    return this.cases.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "List cases visible to the caller (paginated, searchable)" })
  @ApiOkResponse({ type: PaginatedCasesDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCasesQueryDto,
  ): Promise<PaginatedCasesDto> {
    return this.cases.list(user, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a case by id" })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiNotFoundResponse({ description: "Not found or not visible to the caller" })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CaseResponseDto> {
    return this.cases.findOne(user, id);
  }

  @Patch(":id")
  @Roles(Role.PARENT)
  @ApiOperation({ summary: "Update a case (owner only)" })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiForbiddenResponse({ description: "Visible but not owned (e.g. invited tutor)" })
  @ApiNotFoundResponse({ description: "Not found or not visible" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateCaseDto,
  ): Promise<CaseResponseDto> {
    return this.cases.update(user, id, dto);
  }

  @Post(":id/invites")
  @Roles(Role.PARENT)
  @ApiOperation({ summary: "Invite a tutor to a case (owner only)" })
  @ApiNotFoundResponse({ description: "Case or tutor not found" })
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: InviteDto,
  ): Promise<{ caseId: string; tutorId: string }> {
    const invite = await this.cases.invite(user, id, dto.tutorId);
    return { caseId: invite.caseId, tutorId: invite.tutorId };
  }

  @Delete(":id/invites/:tutorId")
  @Roles(Role.PARENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a tutor's invite (owner only)" })
  @ApiNotFoundResponse({ description: "Case or invite not found" })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("tutorId") tutorId: string,
  ): Promise<void> {
    await this.cases.revokeInvite(user, id, tutorId);
  }
}
