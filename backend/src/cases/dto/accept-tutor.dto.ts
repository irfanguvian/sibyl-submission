import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class AcceptTutorDto {
  @ApiProperty({ description: "Id of the invited tutor to accept (matches the case)" })
  @IsString()
  @IsUUID()
  tutorId!: string;
}
