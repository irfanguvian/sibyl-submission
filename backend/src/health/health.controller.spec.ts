import { Test, type TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("GET /health returns {status: 'ok'}", () => {
    expect(controller.check()).toEqual({ status: "ok" });
  });
});
