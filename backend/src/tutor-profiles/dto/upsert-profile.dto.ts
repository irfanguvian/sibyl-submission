import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from "class-validator";

export class UpsertProfileDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ type: [String], example: ["BSc Mathematics", "PGCE"] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  qualifications!: string[];

  @ApiProperty({ type: [String], example: ["5 years GCSE tutoring"] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  experiences!: string[];
}
