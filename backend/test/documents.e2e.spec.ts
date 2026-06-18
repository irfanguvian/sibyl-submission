import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type E2EContext, PASSWORD, createE2EApp, resetDb, seedUsers } from "./utils/e2e";

// A minimal valid PDF (magic bytes %PDF).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("Documents (e2e)", () => {
  let ctx: E2EContext;
  let tutor1Id: string;
  let parentToken: string;
  let tutor1Token: string;
  let tutor2Token: string;
  let caseId: string;

  const http = () => supertest(ctx.app.getHttpServer());
  const login = async (email: string): Promise<string> => {
    const res = await http().post("/auth/login").send({ email, password: PASSWORD });
    return res.body.accessToken;
  };

  beforeAll(async () => {
    ctx = await createE2EApp();
    await resetDb(ctx.prisma);
    ({ tutor1Id } = await seedUsers(ctx.prisma));
    [parentToken, tutor1Token, tutor2Token] = await Promise.all([
      login("parent@example.com"),
      login("tutor1@example.com"),
      login("tutor2@example.com"),
    ]);
    const created = await http().post("/cases").set("Authorization", `Bearer ${parentToken}`).send({
      title: "Doc case",
      subject: "Math",
      level: "GCSE",
      location: "Leeds",
      budgetPerHour: 30,
    });
    caseId = created.body.id;
    await http()
      .post(`/cases/${caseId}/invites`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ tutorId: tutor1Id });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const upload = (token: string, buf: Buffer, name: string) =>
    http()
      .post(`/cases/${caseId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", buf, { filename: name, contentType: "application/pdf" });

  it("parent uploads a PDF → 201, metadata only (never the storage key)", async () => {
    const res = await upload(parentToken, PDF, "report.pdf").expect(201);
    expect(res.body).toMatchObject({
      originalName: "report.pdf",
      mime: "application/pdf",
      caseId,
    });
    expect(res.body).not.toHaveProperty("storedKey");
    expect(JSON.stringify(res.body)).not.toMatch(/storedKey|\/var\/|\/app\//);
  });

  it("download re-checks authz and 302-redirects to a presigned URL", async () => {
    const up = await upload(parentToken, PDF, "dl.pdf").expect(201);
    const res = await http()
      .get(`/documents/${up.body.id}/download`)
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(302);
    expect(res.headers.location).toMatch(/^https:\/\/signed\.example\//);
  });

  it("invited tutor can upload and download", async () => {
    const up = await upload(tutor1Token, PDF, "tutor.pdf").expect(201);
    await http()
      .get(`/documents/${up.body.id}/download`)
      .set("Authorization", `Bearer ${tutor1Token}`)
      .expect(302);
  });

  it("uninvited tutor: upload and download both 404", async () => {
    const up = await upload(parentToken, PDF, "secret.pdf").expect(201);
    await upload(tutor2Token, PDF, "evil.pdf").expect(404);
    await http()
      .get(`/documents/${up.body.id}/download`)
      .set("Authorization", `Bearer ${tutor2Token}`)
      .expect(404);
  });

  it("oversized upload → 413", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(11 * 1024 * 1024, 0x41)]);
    await upload(parentToken, big, "big.pdf").expect(413);
  });

  it("spoofed extension (text bytes, .pdf name) → 415", async () => {
    const fake = Buffer.from("this is plain text, not a pdf");
    await upload(parentToken, fake, "fake.pdf").expect(415);
  });

  it("lists documents for an authorized case", async () => {
    const res = await http()
      .get(`/cases/${caseId}/documents`)
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).not.toHaveProperty("storedKey");
  });
});
