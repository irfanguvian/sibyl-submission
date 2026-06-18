import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import type { Env } from "./env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<Env, true>);

  // Security headers
  app.use(helmet());

  // CORS allowlist (comma-separated origins; credentials for the FE BFF)
  app.enableCors({
    origin: configService
      .get("CORS_ORIGINS", { infer: true })
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
  });

  // Global exception filter — never leaks stack traces
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Tuition API")
    .setDescription("Tuition platform REST API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
  });

  const port = configService.get("PORT", { infer: true }) ?? 3001;
  await app.listen(port);
}

bootstrap();
