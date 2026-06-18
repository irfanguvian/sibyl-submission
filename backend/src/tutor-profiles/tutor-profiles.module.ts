import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { TutorProfilesController } from "./tutor-profiles.controller";
import { TutorProfilesService } from "./tutor-profiles.service";

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [TutorProfilesController],
  providers: [TutorProfilesService],
})
export class TutorProfilesModule {}
