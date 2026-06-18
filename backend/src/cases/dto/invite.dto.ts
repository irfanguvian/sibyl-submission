import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class InviteDto {
  @ApiProperty({ description: "Id of the tutor to invite" })
  @IsString()
  @IsUUID()
  tutorId!: string;
}
