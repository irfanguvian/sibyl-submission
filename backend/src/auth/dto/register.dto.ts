import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "tutor@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ example: "Jane Doe", maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}

export class RegisterResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}
