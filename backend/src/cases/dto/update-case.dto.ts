import { ApiPropertyOptional } from "@nestjs/swagger";
import { CaseStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

/** Whitelisted editable fields. Ownership/role are enforced in the service layer. */
export class UpdateCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetPerHour?: number;

  @ApiPropertyOptional({ enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
