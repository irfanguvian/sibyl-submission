import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateCaseDto {
  @ApiProperty({ example: "Maths tutor for GCSE" })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: "Mathematics" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  subject!: string;

  @ApiProperty({ example: "GCSE" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  level!: string;

  @ApiProperty({ example: "London, UK" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location!: string;

  @ApiProperty({ example: 40, description: "Budget per hour in whole currency units" })
  @IsInt()
  @Min(0)
  budgetPerHour!: number;
}
