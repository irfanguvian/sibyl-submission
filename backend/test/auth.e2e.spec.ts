import { randomUUID } from "node:crypto";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type E2EContext, PASSWORD, createE2EApp, resetDb, seedUsers } from "./utils/e2e";

describe("Auth (e2e)", () => {
  let ctx: E2EContext;
  let parentId: string;
  const http = () => supertest(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createE2EApp();
    await resetDb(ctx.prisma);
    ({ parentId } = await seedUsers(ctx.prisma));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("login with valid credentials → 200 + token pair", async () => {
    const res = await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: PASSWORD })
      .expect(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.expiresIn).toBeGreaterThan(0);
  });

  it("login with wrong password → 401", async () => {
    await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: "wrongpassword" })
      .expect(401);
  });

  it("login with unknown email → 401 (no user enumeration)", async () => {
    await http()
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD })
      .expect(401);
  });

  it("GET /auth/me without a bearer token → 401", async () => {
    await http().get("/auth/me").expect(401);
  });

  it("GET /auth/me with a valid token → 200 + user", async () => {
    const { body } = await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: PASSWORD });
    const res = await http()
      .get("/auth/me")
      .set("Authorization", `Bearer ${body.accessToken}`)
      .expect(200);
    expect(res.body).toEqual({ id: parentId, email: "parent@example.com", role: "PARENT" });
  });

  it("expired access token → 401", async () => {
    const expired = await ctx.jwt.signAsync(
      { sub: parentId, role: "PARENT", jti: randomUUID() },
      { expiresIn: -10 },
    );
    await http().get("/auth/me").set("Authorization", `Bearer ${expired}`).expect(401);
  });

  it("refresh rotates the pair: the old access token is revoked, the new one works", async () => {
    const { body: pair } = await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: PASSWORD });

    const { body: rotated } = await http()
      .post("/auth/refresh")
      .send({ refreshToken: pair.refreshToken })
      .expect(200);

    // Old access token is revoked by rotation.
    await http().get("/auth/me").set("Authorization", `Bearer ${pair.accessToken}`).expect(401);
    // New access token works.
    await http().get("/auth/me").set("Authorization", `Bearer ${rotated.accessToken}`).expect(200);
  });

  it("reusing a revoked refresh token → 401 and kills the whole token family", async () => {
    const { body: pair } = await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: PASSWORD });

    const { body: rotated } = await http()
      .post("/auth/refresh")
      .send({ refreshToken: pair.refreshToken })
      .expect(200);

    // Reuse of the now-revoked R1 is rejected …
    await http().post("/auth/refresh").send({ refreshToken: pair.refreshToken }).expect(401);
    // … and the family revoke takes down the access token issued by the rotation.
    await http().get("/auth/me").set("Authorization", `Bearer ${rotated.accessToken}`).expect(401);
  });

  it("logout revokes the access token immediately → subsequent use 401", async () => {
    const { body: pair } = await http()
      .post("/auth/login")
      .send({ email: "parent@example.com", password: PASSWORD });

    await http()
      .post("/auth/logout")
      .set("Authorization", `Bearer ${pair.accessToken}`)
      .expect(204);

    await http().get("/auth/me").set("Authorization", `Bearer ${pair.accessToken}`).expect(401);
  });
});
