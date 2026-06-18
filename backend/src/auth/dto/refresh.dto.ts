import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RefreshDto {
  @ApiProperty({ description: "The opaque refresh token returned by login/refresh" })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
