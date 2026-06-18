import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: "Opaque refresh token; store securely (httpOnly cookie on the FE)" })
  refreshToken!: string;

  @ApiProperty({ description: "Access-token lifetime in seconds" })
  expiresIn!: number;
}

export class MeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}
