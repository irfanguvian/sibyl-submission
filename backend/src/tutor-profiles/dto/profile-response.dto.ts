import { ApiProperty } from "@nestjs/swagger";

export class TutorProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ type: [String] })
  qualifications!: string[];

  @ApiProperty({ type: [String] })
  experiences!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedProfilesDto {
  @ApiProperty({ type: [TutorProfileResponseDto] })
  data!: TutorProfileResponseDto[];

  @ApiProperty()
  meta!: { page: number; pageSize: number; total: number; totalPages: number };
}
