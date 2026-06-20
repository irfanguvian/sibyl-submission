import { ApiProperty } from "@nestjs/swagger";
import type { Document } from "@prisma/client";
import type { DocumentWithUploader } from "../documents.service";

/** Document metadata returned to clients — never includes the storage key. */
export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  mime!: string;

  @ApiProperty({ nullable: true })
  caseId!: string | null;

  @ApiProperty({ description: "Id of the user who uploaded the document" })
  uploadedById!: string;

  @ApiProperty({ description: "Display name of the uploader (tutor displayName, else email)" })
  uploaderName!: string;

  @ApiProperty()
  createdAt!: Date;

  static from(doc: Document): DocumentResponseDto {
    return {
      id: doc.id,
      originalName: doc.originalName,
      size: doc.size,
      mime: doc.mime,
      caseId: doc.caseId,
      uploadedById: doc.uploadedById,
      uploaderName: doc.uploadedById,
      createdAt: doc.createdAt,
    };
  }

  /** Map a case document joined with its uploader, resolving a human-readable name. */
  static fromWithUploader(doc: DocumentWithUploader): DocumentResponseDto {
    return {
      id: doc.id,
      originalName: doc.originalName,
      size: doc.size,
      mime: doc.mime,
      caseId: doc.caseId,
      uploadedById: doc.uploadedById,
      uploaderName: doc.uploadedBy.tutorProfile?.displayName ?? doc.uploadedBy.email,
      createdAt: doc.createdAt,
    };
  }
}
