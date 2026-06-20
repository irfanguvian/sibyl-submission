import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type E2EContext, PASSWORD, createE2EApp, resetDb, seedUsers } from "./utils/e2e";

// A minimal valid PDF (magic bytes %PDF).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("Documents (e2e)", () => {
  let ctx: E2EContext;
  let tutor1Id: string;
  let tutor2Id: string;
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
    ({ tutor1Id, tutor2Id } = await seedUsers(ctx.prisma));
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

  describe("soft-delete", () => {
    // Isolated case so list counts stay deterministic across the suite.
    let isoCaseId: string;
    beforeAll(async () => {
      const created = await http()
        .post("/cases")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          title: "Del case",
          subject: "Math",
          level: "GCSE",
          location: "Hull",
          budgetPerHour: 25,
        })
        .expect(201);
      isoCaseId = created.body.id;
      await http()
        .post(`/cases/${isoCaseId}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);
    });

    const isoUpload = (token: string, name: string) =>
      http()
        .post(`/cases/${isoCaseId}/documents`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", PDF, { filename: name, contentType: "application/pdf" });

    it("uploader soft-deletes → 204; doc vanishes from list and download 404s", async () => {
      const up = await isoUpload(parentToken, "doomed.pdf").expect(201);
      const docId = up.body.id;

      await http()
        .delete(`/cases/${isoCaseId}/documents/${docId}`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(204);

      const list = await http()
        .get(`/cases/${isoCaseId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);
      expect(list.body.map((d: { id: string }) => d.id)).not.toContain(docId);

      await http()
        .get(`/documents/${docId}/download`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(404);
    });

    it("deleting again after soft-delete → 404 (idempotent absence)", async () => {
      const up = await isoUpload(parentToken, "twice.pdf").expect(201);
      const docId = up.body.id;
      await http()
        .delete(`/cases/${isoCaseId}/documents/${docId}`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(204);
      await http()
        .delete(`/cases/${isoCaseId}/documents/${docId}`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(404);
    });

    it("non-uploader (the invited tutor) cannot delete the parent's doc → 403", async () => {
      const up = await isoUpload(parentToken, "owned.pdf").expect(201);
      await http()
        .delete(`/cases/${isoCaseId}/documents/${up.body.id}`)
        .set("Authorization", `Bearer ${tutor1Token}`)
        .expect(403);
      // Still downloadable: the 403 did not delete it.
      await http()
        .get(`/documents/${up.body.id}/download`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(302);
    });

    it("an uninvited tutor deleting → 404 (no existence leak)", async () => {
      const up = await isoUpload(parentToken, "hidden.pdf").expect(201);
      await http()
        .delete(`/cases/${isoCaseId}/documents/${up.body.id}`)
        .set("Authorization", `Bearer ${tutor2Token}`)
        .expect(404);
    });
  });

  describe("multi-upload", () => {
    it("two uploads to one case are both listed", async () => {
      const created = await http()
        .post("/cases")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          title: "Multi",
          subject: "Math",
          level: "GCSE",
          location: "York",
          budgetPerHour: 20,
        })
        .expect(201);
      const multiId = created.body.id;

      const upA = await http()
        .post(`/cases/${multiId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" })
        .expect(201);
      const upB = await http()
        .post(`/cases/${multiId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .attach("file", PDF, { filename: "b.pdf", contentType: "application/pdf" })
        .expect(201);

      const list = await http()
        .get(`/cases/${multiId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);
      const ids = list.body.map((d: { id: string }) => d.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(upA.body.id);
      expect(ids).toContain(upB.body.id);
    });
  });

  describe("upload ACL — Phase 10 (US-003)", () => {
    // Each sub-test uses its own isolated case to avoid interference.

    it("invited-but-not-matched tutor uploading to a MATCHED case → 404", async () => {
      // Create a case, invite both tutors, then accept tutor1 (MATCHED).
      const created = await http()
        .post("/cases")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          title: "Matched case",
          subject: "Physics",
          level: "A-Level",
          location: "Bath",
          budgetPerHour: 40,
        })
        .expect(201);
      const matchedCaseId = created.body.id;

      // Invite both tutors.
      await http()
        .post(`/cases/${matchedCaseId}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(201);
      await http()
        .post(`/cases/${matchedCaseId}/invites`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor2Id })
        .expect(201);

      // Accept tutor1 → case becomes MATCHED with matchedTutorId = tutor1Id.
      await http()
        .post(`/cases/${matchedCaseId}/accept`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ tutorId: tutor1Id })
        .expect(200);

      // tutor2 is invited but NOT the matched tutor → the matched case is no longer
      // visible to them, so the case appears not to exist → 404 (no existence leak).
      await http()
        .post(`/cases/${matchedCaseId}/documents`)
        .set("Authorization", `Bearer ${tutor2Token}`)
        .attach("file", PDF, { filename: "blocked.pdf", contentType: "application/pdf" })
        .expect(404);

      // Sanity: the matched tutor (tutor1) can still upload.
      await http()
        .post(`/cases/${matchedCaseId}/documents`)
        .set("Authorization", `Bearer ${tutor1Token}`)
        .attach("file", PDF, { filename: "allowed.pdf", contentType: "application/pdf" })
        .expect(201);
    });

    it("any upload to a CLOSED case → 403 (even the owner)", async () => {
      const created = await http()
        .post("/cases")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          title: "Closed case",
          subject: "Chemistry",
          level: "GCSE",
          location: "Exeter",
          budgetPerHour: 25,
        })
        .expect(201);
      const closedCaseId = created.body.id;

      // Close the case via PATCH.
      await http()
        .patch(`/cases/${closedCaseId}`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({ status: "CLOSED" })
        .expect(200);

      // Owner attempt → 403.
      await http()
        .post(`/cases/${closedCaseId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .attach("file", PDF, { filename: "nope.pdf", contentType: "application/pdf" })
        .expect(403);
    });

    it("GET /cases/:caseId/documents response objects include uploaderName", async () => {
      // Use the main caseId (parent uploaded at least one doc in the outer beforeAll).
      const res = await http()
        .get(`/cases/${caseId}/documents`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      for (const doc of res.body) {
        expect(doc).toHaveProperty("uploaderName");
        expect(typeof doc.uploaderName).toBe("string");
        expect(doc.uploaderName.length).toBeGreaterThan(0);
      }
    });
  });
});
