import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { DocumentsService } from "../documents/documents.service";
import { DocumentResponseDto } from "../documents/dto/document-response.dto";
import { ListProfilesQueryDto } from "./dto/list-profiles-query.dto";
import { PaginatedProfilesDto, TutorProfileResponseDto } from "./dto/profile-response.dto";
import { UpsertProfileDto } from "./dto/upsert-profile.dto";
import { TutorProfilesService } from "./tutor-profiles.service";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags("tutor-profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tutor-profiles")
export class TutorProfilesController {
  constructor(
    private readonly profiles: TutorProfilesService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  @Roles(Role.PARENT)
  @ApiOperation({ summary: "Browse the tutor directory (parents only)" })
  @ApiOkResponse({ type: PaginatedProfilesDto })
  @ApiForbiddenResponse({ description: "Not a parent" })
  listDirectory(@Query() query: ListProfilesQueryDto): Promise<PaginatedProfilesDto> {
    return this.profiles.listDirectory(query);
  }

  @Get("me")
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: "Get the caller's own tutor profile" })
  @ApiOkResponse({ type: TutorProfileResponseDto })
  getOwn(@CurrentUser() user: AuthenticatedUser): Promise<TutorProfileResponseDto> {
    return this.profiles.getOwn(user);
  }

  @Put("me")
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: "Create or update the caller's own tutor profile" })
  @ApiOkResponse({ type: TutorProfileResponseDto })
  upsertOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertProfileDto,
  ): Promise<TutorProfileResponseDto> {
    return this.profiles.upsertOwn(user, dto);
  }

  @Post("me/documents")
  @Roles(Role.TUTOR)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
  })
  @ApiOperation({ summary: "Upload a supporting document to the caller's profile" })
  @ApiOkResponse({ type: DocumentResponseDto })
  async uploadOwnDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documents.uploadToOwnProfile(user, file);
    return DocumentResponseDto.from(doc);
  }

  @Delete("me/documents/:docId")
  @Roles(Role.TUTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a document from the caller's profile" })
  @ApiNotFoundResponse({ description: "Document not found" })
  async deleteOwnDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("docId") docId: string,
  ): Promise<void> {
    await this.documents.deleteOwnProfileDocument(user, docId);
  }

  @Get(":id")
  @ApiOperation({ summary: "View a tutor profile (parents: any; tutors: own only)" })
  @ApiOkResponse({ type: TutorProfileResponseDto })
  @ApiNotFoundResponse({ description: "Not found or not visible to the caller" })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<TutorProfileResponseDto> {
    return this.profiles.getById(user, id);
  }

  @Get(":id/documents")
  @ApiOperation({ summary: "List a profile's documents (parents: any; tutors: own only)" })
  @ApiOkResponse({ type: [DocumentResponseDto] })
  async listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await this.documents.listForProfile(user, id);
    return docs.map(DocumentResponseDto.from);
  }
}
