import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DocumentsService } from "./documents.service";
import { DocumentResponseDto } from "./dto/document-response.dto";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("cases/:caseId/documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
  })
  @ApiOperation({
    summary: "Upload a document to a case",
    description:
      "Upload ACL: OPEN → owner + any invited tutor; MATCHED → owner + matched tutor only; CLOSED → nobody (incl. owner). Non-viewers get 404.",
  })
  @ApiOkResponse({ type: DocumentResponseDto })
  @ApiForbiddenResponse({ description: "Closed case, or tutor not permitted to upload" })
  @ApiResponse({ status: 413, description: "File exceeds 10 MB" })
  @ApiResponse({ status: 415, description: "Unsupported file type" })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("caseId") caseId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documents.uploadToCase(user, caseId, file);
    return DocumentResponseDto.from(doc);
  }

  @Get("cases/:caseId/documents")
  @ApiOperation({ summary: "List documents on a case" })
  @ApiOkResponse({ type: [DocumentResponseDto] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("caseId") caseId: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await this.documents.listForCase(user, caseId);
    return docs.map(DocumentResponseDto.fromWithUploader);
  }

  @Delete("cases/:caseId/documents/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a case document (uploader only)" })
  @ApiNoContentResponse({ description: "Document deleted" })
  @ApiForbiddenResponse({ description: "Caller is not the uploader" })
  @ApiNotFoundResponse({ description: "Document not found or not visible" })
  async deleteForCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param("caseId") caseId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.documents.deleteForCase(user, caseId, id);
  }

  @Get("documents/:id/download")
  @ApiOperation({ summary: "Download a document (302 redirect to a 60s presigned URL)" })
  @ApiResponse({ status: 302, description: "Redirect to a presigned URL" })
  @ApiNotFoundResponse({ description: "Not found or not visible to the caller" })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.documents.getDownloadUrl(user, id);
    res.redirect(302, url);
  }
}
