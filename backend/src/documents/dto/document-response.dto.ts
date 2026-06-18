import { ApiProperty } from "@nestjs/swagger";
import type { Document } from "@prisma/client";

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

  @ApiProperty()
  createdAt!: Date;

  static from(doc: Document): DocumentResponseDto {
    return {
      id: doc.id,
      originalName: doc.originalName,
      size: doc.size,
      mime: doc.mime,
      caseId: doc.caseId,
      createdAt: doc.createdAt,
    };
  }
}
