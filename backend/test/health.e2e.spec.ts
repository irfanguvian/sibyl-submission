import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Smoke test only — stub Prisma so the app boots without a live database.
      // Database-backed e2e (auth/cases/etc.) run against a real Postgres.
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health → 200 {status: 'ok'}", async () => {
    const response = await supertest(app.getHttpServer()).get("/health").expect(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
