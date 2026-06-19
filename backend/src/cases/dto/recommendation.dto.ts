import { ApiProperty } from "@nestjs/swagger";

export class RecommendationDto {
  @ApiProperty({ description: "Id of the recommended tutor (User id)" })
  tutorId!: string;

  @ApiProperty({ description: "Tutor display name" })
  displayName!: string;

  @ApiProperty({ type: [String], description: "Tutor qualifications" })
  qualifications!: string[];

  @ApiProperty({ description: "Heuristic match score; higher is a better fit" })
  score!: number;

  @ApiProperty({ description: "Whether this tutor is already invited to the case" })
  alreadyInvited!: boolean;
}
