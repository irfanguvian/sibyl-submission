import { randomUUID } from "node:crypto";
import { hash } from "bcrypt";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type E2EContext, PASSWORD, createE2EApp, resetDb, seedUsers } from "./utils/e2e";

describe("Cases & ACL (e2e)", () => {
  let ctx: E2EContext;
  let tutor1Id: string;
  let tutor2Id: string;
  let parentToken: string;
  let parent2Token: string;
  let tutor1Token: string;
  let tutor2Token: string;

  const http = () => supertest(ctx.app.getHttpServer());
  const login = async (email: string): Promise<string> => {
    const res = await http().post("/auth/login").send({ email, password: PASSWORD });
    return res.body.accessToken;
  };
  const sampleCase = (over: Record<string, unknown> = {}) => ({
    title: "Algebra help",
    subject: "Math",
    level: "GCSE",
    location: "London",
    budgetPerHour: 40,
    ...over,
  });

  beforeAll(async () => {
    ctx = await createE2EApp();
    await resetDb(ctx.prisma);
    ({ tutor1Id, tutor2Id } = await seedUsers(ctx.prisma));
    await ctx.prisma.user.create({
      data: {
        email: "parent2@example.com",
        role: "PARENT",
        passwordHash: await hash(PASSWORD, 10),
      },
    });
    [parentToken, parent2Token, tutor1Token, tutor2Token] = await Promise.all([
      login("parent@example.com"),
      login("parent2@example.com"),
      login("tutor1@example.com"),
      login("tutor2@example.com"),
    ]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createCase = async (token: string, over?: Record<string, unknown>): Promise<string> => {
    const res = await http()
      .post("/cases")
      .set("Authorization", `Bearer ${token}`)
      .send(sampleCase(over))
      .expect(201);
    return res.body.id;
  };

  it("parent creates a case (201) and can read it back (200)", async () => {
    const id = await createCase(parentToken);
    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${parentToken}`).expect(200);
  });

  it("a tutor cannot create a case → 403", async () => {
    await http()
      .post("/cases")
      .set("Authorization", `Bearer ${tutor1Token}`)
      .send(sampleCase())
      .expect(403);
  });

  it("another parent gets 404 for a case they do not own (no existence leak)", async () => {
    const id = await createCase(parentToken);
    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${parent2Token}`).expect(404);
  });

  it("an uninvited tutor gets 404", async () => {
    const id = await createCase(parentToken);
    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${tutor1Token}`).expect(404);
  });

  it("invited tutor can view (200) but not edit (403); after revoke → 404", async () => {
    const id = await createCase(parentToken);

    await http()
      .post(`/cases/${id}/invites`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ tutorId: tutor1Id })
      .expect(201);

    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${tutor1Token}`).expect(200);
    await http()
      .patch(`/cases/${id}`)
      .set("Authorization", `Bearer ${tutor1Token}`)
      .send({ title: "hijacked" })
      .expect(403);

    // Uninvited tutor2 still 404.
    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${tutor2Token}`).expect(404);

    await http()
      .delete(`/cases/${id}/invites/${tutor1Id}`)
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(204);
    await http().get(`/cases/${id}`).set("Authorization", `Bearer ${tutor1Token}`).expect(404);
  });

  it("owner can patch whitelisted fields → 200", async () => {
    const id = await createCase(parentToken);
    const res = await http()
      .patch(`/cases/${id}`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ title: "Updated title", status: "MATCHED" })
      .expect(200);
    expect(res.body.title).toBe("Updated title");
    expect(res.body.status).toBe("MATCHED");
  });

  it("inviting a non-tutor → 400; inviting an unknown user → 404", async () => {
    const id = await createCase(parentToken);
    // parent's own id is a PARENT, not a TUTOR.
    const parentId = (await http().get("/auth/me").set("Authorization", `Bearer ${parentToken}`))
      .body.id;
    await http()
      .post(`/cases/${id}/invites`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ tutorId: parentId })
      .expect(400);
    await http()
      .post(`/cases/${id}/invites`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ tutorId: randomUUID() })
      .expect(404);
  });

  it("create with budgetPerHour=0 → 400 (validation @Min(1))", async () => {
    await http()
      .post("/cases")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(sampleCase({ budgetPerHour: 0 }))
      .expect(400);
  });

  it("description round-trips on create and get", async () => {
    const res = await http()
      .post("/cases")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(sampleCase({ description: "Needs algebra and exam technique" }))
      .expect(201);
    expect(res.body.description).toBe("Needs algebra and exam technique");
    expect(res.body.matchedTutorId).toBeNull();

    const got = await http()
      .get(`/cases/${res.body.id}`)
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
    expect(got.body.description).toBe("Needs algebra and exam technique");
  });

  describe("invites listing (owner only)", () => {
    let caseId: string;
    beforeAll(async () => {
      caseId = await createCase(parentToken);
      await http()
        .post(`/cases/${caseId}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);
    });

    it("owner gets the invited tutor list → 200", async () => {
      const res = await http()
        .get(`/cases/${caseId}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ tutorId: tutor1Id });
      expect(res.body[0]).toHaveProperty("displayName");
      expect(Array.isArray(res.body[0].qualifications)).toBe(true);
    });

    it("a different parent (cannot see the case) → 404", async () => {
      await http()
        .get(`/cases/${caseId}/invites`)
        .set("Authorization", `Bearer ${parent2Token}`)
        .expect(404);
    });

    it("an invited tutor (visible but not owner) → 403", async () => {
      await http()
        .get(`/cases/${caseId}/invites`)
        .set("Authorization", `Bearer ${tutor1Token}`)
        .expect(403);
    });
  });

  describe("accept tutor", () => {
    // POST /cases/:id/accept declares @HttpCode(HttpStatus.OK) → 200 on success
    // (happy + idempotent), matching its @ApiOkResponse contract.
    const ACCEPT_OK = 200;

    it("accepting an uninvited (but real) tutor → 400", async () => {
      const id = await createCase(parentToken);
      await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(400);
    });

    it("accepting an invited tutor → 200 MATCHED + matchedTutorId; tutor keeps access", async () => {
      const id = await createCase(parentToken);
      await http()
        .post(`/cases/${id}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);

      const res = await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(ACCEPT_OK);
      expect(res.body.status).toBe("MATCHED");
      expect(res.body.matchedTutorId).toBe(tutor1Id);

      // The matched tutor (still invited) retains view access.
      await http().get(`/cases/${id}`).set("Authorization", `Bearer ${tutor1Token}`).expect(200);
    });

    it("re-accepting the same matched tutor is idempotent → 200", async () => {
      const id = await createCase(parentToken);
      await http()
        .post(`/cases/${id}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);
      await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(ACCEPT_OK);
      const again = await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(ACCEPT_OK);
      expect(again.body.matchedTutorId).toBe(tutor1Id);
    });

    it("accepting a second, different tutor after a match → 409", async () => {
      const id = await createCase(parentToken);
      await http()
        .post(`/cases/${id}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);
      await http()
        .post(`/cases/${id}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor2Id })
        .expect(201);

      await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(ACCEPT_OK);
      await http()
        .post(`/cases/${id}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor2Id })
        .expect(409);
    });
  });

  describe("recommendations (owner only)", () => {
    let id: string;
    beforeAll(async () => {
      id = await createCase(parentToken, { subject: "Math", title: "Algebra coaching" });
    });

    it("owner gets a ranked recommendation list → 200", async () => {
      const res = await http()
        .get(`/cases/${id}/recommendations`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Seeded tutors have empty profiles → at most 5 entries, sorted by score desc.
      expect(res.body.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i - 1].score).toBeGreaterThanOrEqual(res.body[i].score);
      }
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("tutorId");
        expect(res.body[0]).toHaveProperty("alreadyInvited");
      }
    });

    it("a different parent (cannot see the case) → 404", async () => {
      await http()
        .get(`/cases/${id}/recommendations`)
        .set("Authorization", `Bearer ${parent2Token}`)
        .expect(404);
    });
  });

  describe("list: pagination / search / filters", () => {
    let listParent: string;
    beforeAll(async () => {
      // Fresh parent so the list count is deterministic.
      await ctx.prisma.user.create({
        data: {
          email: "lister@example.com",
          role: "PARENT",
          passwordHash: await hash(PASSWORD, 10),
        },
      });
      listParent = await login("lister@example.com");
      await createCase(listParent, { title: "Physics A", subject: "Physics", level: "A-Level" });
      await createCase(listParent, { title: "Physics B", subject: "Physics", level: "A-Level" });
      await createCase(listParent, { title: "Chemistry C", subject: "Chemistry", level: "GCSE" });
    });

    it("paginates with honest meta", async () => {
      const res = await http()
        .get("/cases?page=1&pageSize=2")
        .set("Authorization", `Bearer ${listParent}`)
        .expect(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    });

    it("out-of-range page → empty data, honest meta", async () => {
      const res = await http()
        .get("/cases?page=99&pageSize=10")
        .set("Authorization", `Bearer ${listParent}`)
        .expect(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(3);
    });

    it("filters by subject and searches the title", async () => {
      const bySubject = await http()
        .get("/cases?subject=Physics")
        .set("Authorization", `Bearer ${listParent}`)
        .expect(200);
      expect(bySubject.body.data).toHaveLength(2);

      const byTitle = await http()
        .get("/cases?q=Chemistry")
        .set("Authorization", `Bearer ${listParent}`)
        .expect(200);
      expect(byTitle.body.data).toHaveLength(1);
    });

    it("invalid status filter → 400", async () => {
      await http()
        .get("/cases?status=BOGUS")
        .set("Authorization", `Bearer ${listParent}`)
        .expect(400);
    });
  });
});
