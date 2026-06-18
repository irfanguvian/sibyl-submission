import { ApiProperty } from "@nestjs/swagger";
import { CaseStatus } from "@prisma/client";

export class CaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  level!: string;

  @ApiProperty()
  location!: string;

  @ApiProperty()
  budgetPerHour!: number;

  @ApiProperty({ enum: CaseStatus })
  status!: CaseStatus;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedCasesDto {
  @ApiProperty({ type: [CaseResponseDto] })
  data!: CaseResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}
