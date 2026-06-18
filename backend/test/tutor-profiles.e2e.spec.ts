import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type E2EContext, PASSWORD, createE2EApp, resetDb, seedUsers } from "./utils/e2e";

describe("Tutor profiles & directory (e2e)", () => {
  let ctx: E2EContext;
  let parentToken: string;
  let tutor1Token: string;
  let tutor2Token: string;
  let tutor1ProfileId: string;

  const http = () => supertest(ctx.app.getHttpServer());
  const login = async (email: string): Promise<string> => {
    const res = await http().post("/auth/login").send({ email, password: PASSWORD });
    return res.body.accessToken;
  };
  const upsert = (token: string, displayName: string) =>
    http()
      .put("/tutor-profiles/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName, qualifications: ["BSc Math"], experiences: ["5y tutoring"] });

  beforeAll(async () => {
    ctx = await createE2EApp();
    await resetDb(ctx.prisma);
    await seedUsers(ctx.prisma);
    [parentToken, tutor1Token, tutor2Token] = await Promise.all([
      login("parent@example.com"),
      login("tutor1@example.com"),
      login("tutor2@example.com"),
    ]);
    const p1 = await upsert(tutor1Token, "Alice Tutor").expect(200);
    tutor1ProfileId = p1.body.id;
    await upsert(tutor2Token, "Bob Tutor").expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("tutor reads back its own profile", async () => {
    const res = await http()
      .get("/tutor-profiles/me")
      .set("Authorization", `Bearer ${tutor1Token}`)
      .expect(200);
    expect(res.body.displayName).toBe("Alice Tutor");
  });

  it("a parent cannot create or read /me (tutor-only) → 403", async () => {
    await http()
      .get("/tutor-profiles/me")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(403);
    await http()
      .put("/tutor-profiles/me")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ displayName: "Nope", qualifications: [], experiences: [] })
      .expect(403);
  });

  it("directory is parent-only: parent 200, tutor 403", async () => {
    const res = await http()
      .get("/tutor-profiles?page=1&pageSize=10")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
    expect(res.body.meta.total).toBe(2);
    await http().get("/tutor-profiles").set("Authorization", `Bearer ${tutor1Token}`).expect(403);
  });

  it("directory paginates and searches by display name", async () => {
    const page = await http()
      .get("/tutor-profiles?page=1&pageSize=1")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.totalPages).toBe(2);

    const search = await http()
      .get("/tutor-profiles?q=Alice")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].displayName).toBe("Alice Tutor");
  });

  it("a parent can view any profile by id (200)", async () => {
    await http()
      .get(`/tutor-profiles/${tutor1ProfileId}`)
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
  });

  it("a tutor can view its own profile by id (200) but not another tutor's (D9 → 404)", async () => {
    await http()
      .get(`/tutor-profiles/${tutor1ProfileId}`)
      .set("Authorization", `Bearer ${tutor1Token}`)
      .expect(200);
    await http()
      .get(`/tutor-profiles/${tutor1ProfileId}`)
      .set("Authorization", `Bearer ${tutor2Token}`)
      .expect(404);
  });
});
