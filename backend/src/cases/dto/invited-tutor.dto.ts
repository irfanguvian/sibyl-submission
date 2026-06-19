import { ApiProperty } from "@nestjs/swagger";

export class InvitedTutorDto {
  @ApiProperty({ description: "Id of the invited tutor (User id)" })
  tutorId!: string;

  @ApiProperty({ description: "Tutor display name; falls back to email or empty string" })
  displayName!: string;

  @ApiProperty({ type: [String], description: "Tutor qualifications (empty if no profile yet)" })
  qualifications!: string[];
}
