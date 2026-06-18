import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CasesModule } from "./cases/cases.module";
import { DocumentsModule } from "./documents/documents.module";
import { validateEnv } from "./env";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { TutorProfilesModule } from "./tutor-profiles/tutor-profiles.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global default rate limit (per IP); /auth/login tightens this further.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    AuthModule,
    CasesModule,
    DocumentsModule,
    TutorProfilesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
