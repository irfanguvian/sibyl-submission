import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasesModule } from "../cases/cases.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [AuthModule, CasesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
