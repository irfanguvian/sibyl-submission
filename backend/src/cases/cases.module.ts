import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CaseAccessService } from "./case-access.service";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { RecommendationsService } from "./recommendations.service";

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CaseAccessService, RecommendationsService],
  exports: [CaseAccessService],
})
export class CasesModule {}
