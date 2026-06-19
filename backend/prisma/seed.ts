import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CaseStatus, PrismaClient, Role } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

/**
 * Demo credentials (documented in README):
 *   parent@example.com  / password123  (PARENT)
 *   parent2@example.com / password123  (PARENT)
 *   tutor1@example.com … tutor6@example.com / password123  (TUTOR)
 *
 * The seed wipes all tables first, then inserts, so the DB always reflects
 * exactly this file — re-running is safe and never duplicates rows (the
 * upserts below are belt-and-suspenders after the wipe). It populates tutor
 * profiles (the directory reads the
 * TutorProfile table, so without these a parent sees an empty directory),
 * cases across all statuses, an invite, and a few documents so the UI is not
 * empty for demos and manual testing.
 */
const DEMO_PASSWORD = "password123";

type SeedUser = { id: string; email: string; role: Role };

const parents: SeedUser[] = [
  { id: "00000000-0000-4000-8000-000000000001", email: "parent@example.com", role: Role.PARENT },
  { id: "00000000-0000-4000-8000-000000000002", email: "parent2@example.com", role: Role.PARENT },
];

const tutors: Array<
  SeedUser & { displayName: string; qualifications: string[]; experiences: string[] }
> = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    email: "tutor1@example.com",
    role: Role.TUTOR,
    displayName: "Aisha Rahman",
    qualifications: ["BSc Mathematics, NUS, 2018", "MOE registered tutor"],
    experiences: ["6 years teaching Secondary A-Math", "Specialises in O-Level prep"],
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    email: "tutor2@example.com",
    role: Role.TUTOR,
    displayName: "Benjamin Tan",
    qualifications: ["BA English Literature, NTU, 2020"],
    experiences: ["4 years teaching Primary & Secondary English", "Ex-MOE school teacher"],
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    email: "tutor3@example.com",
    role: Role.TUTOR,
    displayName: "Chloe Lim",
    qualifications: ["BSc Physics, NUS, 2019", "PGDE (Secondary)"],
    experiences: ["5 years teaching JC Physics", "H2 Physics specialist"],
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    email: "tutor4@example.com",
    role: Role.TUTOR,
    displayName: "Daniel Wong",
    qualifications: ["BBA Accountancy, SMU, 2017"],
    experiences: ["3 years teaching Secondary Principles of Accounts"],
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    email: "tutor5@example.com",
    role: Role.TUTOR,
    displayName: "Emily Goh",
    qualifications: ["BSc Chemistry, NUS, 2021"],
    experiences: ["2 years teaching O & A-Level Chemistry"],
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    email: "tutor6@example.com",
    role: Role.TUTOR,
    displayName: "Farhan Ismail",
    qualifications: ["BSc Computer Science, NTU, 2022", "Diploma in Chinese Studies"],
    experiences: ["3 years teaching Primary Chinese", "Conversational Mandarin coach"],
  },
];

type SeedCase = {
  id: string;
  title: string;
  subject: string;
  level: string;
  location: string;
  budgetPerHour: number;
  status: CaseStatus;
  ownerId: string;
};

const cases: SeedCase[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    title: "Weekly P5 Math tuition near Bishan",
    subject: "Math",
    level: "P5",
    location: "Bishan",
    budgetPerHour: 45,
    status: CaseStatus.OPEN,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    title: "Secondary 3 English essay coaching",
    subject: "English",
    level: "S3",
    location: "Tampines",
    budgetPerHour: 50,
    status: CaseStatus.MATCHED,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    title: "JC1 H2 Physics intensive revision",
    subject: "Physics",
    level: "JC1",
    location: "Clementi",
    budgetPerHour: 70,
    status: CaseStatus.OPEN,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    title: "P3 Chinese conversational practice",
    subject: "Chinese",
    level: "P3",
    location: "Jurong East",
    budgetPerHour: 35,
    status: CaseStatus.CLOSED,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    title: "O-Level Chemistry crash course",
    subject: "Chemistry",
    level: "S4",
    location: "Serangoon",
    budgetPerHour: 55,
    status: CaseStatus.OPEN,
    ownerId: parents[1].id,
  },
];

// Minimal valid PDF + 1x1 PNG so seeded documents actually download.
const SAMPLE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);
const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

type SeedDoc = {
  id: string;
  storedKey: string;
  originalName: string;
  mime: string;
  body: Buffer;
  uploadedById: string;
  caseId?: string;
  tutorProfileId?: string;
};

function tutorProfileId(tutorId: string): string {
  return tutorId; // 1:1 — we set the profile id equal to the tutor user id for determinism
}

const documents: SeedDoc[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    storedKey: "seed-doc-case-201-brief",
    originalName: "p5-math-brief.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: parents[0].id,
    caseId: cases[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    storedKey: "seed-doc-tutor1-cert",
    originalName: "aisha-degree-cert.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: tutors[0].id,
    tutorProfileId: tutorProfileId(tutors[0].id),
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    storedKey: "seed-doc-tutor2-sample",
    originalName: "benjamin-sample-worksheet.png",
    mime: "image/png",
    body: SAMPLE_PNG,
    uploadedById: tutors[1].id,
    tutorProfileId: tutorProfileId(tutors[1].id),
  },
];

function makeS3Client(): { client: S3Client; bucket: string } {
  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  return {
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
      },
    }),
    bucket: process.env.S3_BUCKET ?? "documents",
  };
}

/**
 * Wipe every table before seeding so the DB always reflects exactly this seed
 * file — no stale rows the seed no longer references. Deletes leaf -> root in
 * FK-safe order inside a transaction (independent of the schema's cascade
 * config). Guarded against production: refuses to run when NODE_ENV is
 * "production" unless SEED_FORCE is set, so a mispointed DATABASE_URL can't
 * silently destroy a real database.
 */
async function wipe(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) {
    console.error(
      "Refusing to wipe: NODE_ENV=production and SEED_FORCE is not set. " +
        "Set SEED_FORCE=1 to override (this DELETES ALL DATA).",
    );
    process.exit(1);
  }

  console.warn("wiping all data before seed (delete-then-insert)…");
  await prisma.$transaction([
    prisma.oauthRefreshToken.deleteMany(),
    prisma.oauthAccessToken.deleteMany(),
    prisma.document.deleteMany(),
    prisma.caseInvite.deleteMany(),
    prisma.case.deleteMany(),
    prisma.tutorProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log("wiped all tables");
}

async function main(): Promise<void> {
  await wipe();

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // Users
  for (const u of [...parents, ...tutors]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, passwordHash },
      create: { id: u.id, email: u.email, role: u.role, passwordHash },
    });
  }
  console.log(`seeded ${parents.length} parents, ${tutors.length} tutors`);

  // Tutor profiles — the fix for an empty parent-facing directory
  for (const t of tutors) {
    await prisma.tutorProfile.upsert({
      where: { userId: t.id },
      update: {
        displayName: t.displayName,
        qualifications: t.qualifications,
        experiences: t.experiences,
      },
      create: {
        id: tutorProfileId(t.id),
        userId: t.id,
        displayName: t.displayName,
        qualifications: t.qualifications,
        experiences: t.experiences,
      },
    });
  }
  console.log(`seeded ${tutors.length} tutor profiles`);

  // Cases across all statuses
  for (const c of cases) {
    await prisma.case.upsert({
      where: { id: c.id },
      update: {
        title: c.title,
        subject: c.subject,
        level: c.level,
        location: c.location,
        budgetPerHour: c.budgetPerHour,
        status: c.status,
        ownerId: c.ownerId,
      },
      create: c,
    });
  }
  console.log(`seeded ${cases.length} cases`);

  // Invites: matched case -> tutor; an open case -> another tutor
  const invites = [
    { caseId: cases[1].id, tutorId: tutors[0].id },
    { caseId: cases[0].id, tutorId: tutors[1].id },
  ];
  for (const inv of invites) {
    await prisma.caseInvite.upsert({
      where: { caseId_tutorId: { caseId: inv.caseId, tutorId: inv.tutorId } },
      update: {},
      create: inv,
    });
  }
  console.log(`seeded ${invites.length} case invites`);

  // Documents — upload placeholder bytes so downloads work; fall back to
  // metadata-only if object storage is unreachable.
  const { client, bucket } = makeS3Client();
  let uploaded = 0;
  for (const d of documents) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: d.storedKey,
          Body: d.body,
          ContentType: d.mime,
        }),
      );
      uploaded += 1;
    } catch (err) {
      console.warn(
        `storage upload failed for ${d.storedKey} (metadata-only fallback): ${(err as Error).message}`,
      );
    }
    await prisma.document.upsert({
      where: { storedKey: d.storedKey },
      update: {
        originalName: d.originalName,
        size: d.body.length,
        mime: d.mime,
        uploadedById: d.uploadedById,
        caseId: d.caseId ?? null,
        tutorProfileId: d.tutorProfileId ?? null,
      },
      create: {
        id: d.id,
        storedKey: d.storedKey,
        originalName: d.originalName,
        size: d.body.length,
        mime: d.mime,
        uploadedById: d.uploadedById,
        caseId: d.caseId ?? null,
        tutorProfileId: d.tutorProfileId ?? null,
      },
    });
  }
  console.log(`seeded ${documents.length} documents (${uploaded} bytes uploaded to storage)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
