import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CaseStatus, PrismaClient, Role } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

/**
 * Demo credentials (documented in README):
 *   parent@example.com  / password123  (PARENT)
 *   parent2@example.com / password123  (PARENT)
 *   parent3@example.com / password123  (PARENT)
 *   tutor1@example.com … tutor10@example.com / password123  (TUTOR)
 *
 * Counts: 3 parents, 10 tutors, 12 cases (5 OPEN, 4 MATCHED, 3 CLOSED),
 *         invites across open+matched cases, 9 documents (1 soft-deleted).
 *
 * Notable seed IDs:
 *   Matched cases: 000...0202 (matchedTutorId=tutor2/000...0102)
 *                  000...0207 (matchedTutorId=tutor5/000...0105)
 *   Soft-deleted doc: 000...0309
 *   Min-budget case (budgetPerHour=1): 000...0212
 *
 * The seed wipes all tables first, then inserts, so the DB always reflects
 * exactly this file — re-running is safe and never duplicates rows (the
 * upserts below are belt-and-suspenders after the wipe). It populates tutor
 * profiles (the directory reads the TutorProfile table, so without these a
 * parent sees an empty directory), cases across all statuses, invites, and
 * documents so the UI is not empty for demos and manual testing.
 */
const DEMO_PASSWORD = "password123";

type SeedUser = { id: string; email: string; role: Role };

const parents: SeedUser[] = [
  { id: "00000000-0000-4000-8000-000000000001", email: "parent@example.com", role: Role.PARENT },
  { id: "00000000-0000-4000-8000-000000000002", email: "parent2@example.com", role: Role.PARENT },
  { id: "00000000-0000-4000-8000-000000000003", email: "parent3@example.com", role: Role.PARENT },
];

const tutors: Array<
  SeedUser & { displayName: string; qualifications: string[]; experiences: string[] }
> = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    email: "tutor1@example.com",
    role: Role.TUTOR,
    displayName: "Aisha Rahman",
    qualifications: [
      "BSc Mathematics (First Class Honours), NUS, 2018",
      "MOE registered tutor",
      "NIE Postgraduate Diploma in Education (Secondary), 2019",
    ],
    experiences: [
      "6 years teaching Secondary E-Math and A-Math",
      "Specialises in O-Level and IP Math prep",
      "Track record: 95% of students improved by at least 2 grades",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    email: "tutor2@example.com",
    role: Role.TUTOR,
    displayName: "Benjamin Tan",
    qualifications: [
      "BA English Literature (Honours), NTU, 2020",
      "CELTA certified English teacher",
    ],
    experiences: [
      "4 years teaching Primary and Secondary English composition and comprehension",
      "Ex-MOE school teacher (Tampines Secondary)",
      "Specialises in essay structure, vocabulary building, and oral coaching",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    email: "tutor3@example.com",
    role: Role.TUTOR,
    displayName: "Chloe Lim",
    qualifications: [
      "BSc Physics (First Class Honours), NUS, 2019",
      "PGDE Secondary (Science), NIE, 2020",
    ],
    experiences: [
      "5 years teaching JC H1 and H2 Physics",
      "A-Level Physics specialist — waves, electromagnetism, quantum physics",
      "Former JC lecturer at Temasek JC",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    email: "tutor4@example.com",
    role: Role.TUTOR,
    displayName: "Daniel Wong",
    qualifications: ["BBA Accountancy (Merit), SMU, 2017", "CPA Australia associate member"],
    experiences: [
      "5 years teaching Secondary Principles of Accounts (POA)",
      "Helps students master double-entry, financial statements, and exam technique",
      "90% of students achieved B3 or better at O-Level",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    email: "tutor5@example.com",
    role: Role.TUTOR,
    displayName: "Emily Goh",
    qualifications: ["BSc Chemistry (Second Upper), NUS, 2021", "MOE registered tutor (Science)"],
    experiences: [
      "3 years teaching O-Level and A-Level Chemistry",
      "Strong focus on organic chemistry mechanisms and practical lab skills",
      "Fluent in both Pure Chemistry and Combined Science syllabi",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    email: "tutor6@example.com",
    role: Role.TUTOR,
    displayName: "Farhan Ismail",
    qualifications: [
      "BSc Computer Science, NTU, 2022",
      "Diploma in Chinese Studies, NUS Extension, 2023",
    ],
    experiences: [
      "3 years teaching Primary and Lower Secondary Chinese",
      "Conversational Mandarin coach for working adults",
      "HSK Level 5 certified",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    email: "tutor7@example.com",
    role: Role.TUTOR,
    displayName: "Grace Ng",
    qualifications: [
      "BSc Mathematics (Second Upper), NTU, 2020",
      "MSc Applied Mathematics, NTU, 2022",
    ],
    experiences: [
      "4 years teaching JC H1 and H2 Mathematics",
      "Specialist in calculus, statistics, and complex numbers for A-Level Math",
      "Tutors IP students in IBDP Mathematics SL/HL",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000108",
    email: "tutor8@example.com",
    role: Role.TUTOR,
    displayName: "Hassan Ali",
    qualifications: [
      "BSc Physics and Mathematics (Double Major), NUS, 2018",
      "PGDE Secondary (Physics), NIE, 2019",
    ],
    experiences: [
      "6 years teaching Secondary and JC Physics",
      "Expert in mechanics, optics, and electricity topics",
      "Ran Physics enrichment camps for GEP students",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    email: "tutor9@example.com",
    role: Role.TUTOR,
    displayName: "Isabelle Chua",
    qualifications: [
      "BSc Biological Sciences, NUS, 2019",
      "Graduate Diploma in Education (Junior College), NIE, 2020",
    ],
    experiences: [
      "4 years teaching H1 and H2 Biology at JC level",
      "Specialises in cell biology, genetics, and ecology",
      "Economics tutor (H1) as a second subject",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000110",
    email: "tutor10@example.com",
    role: Role.TUTOR,
    displayName: "James Koh",
    qualifications: [
      "BA Communications and Information Systems, SMU, 2016",
      "AWS Certified Developer – Associate",
    ],
    experiences: [
      "7 years as a software engineer (full-stack, Python, JavaScript)",
      "5 years teaching Secondary Computing and O-Level Computer Applications",
      "Runs coding bootcamps for primary school students (Scratch, Python basics)",
      "Also tutors Economics at O-Level and A-Level (generalist)",
    ],
  },
];

type SeedCase = {
  id: string;
  title: string;
  subject: string;
  level: string;
  location: string;
  budgetPerHour: number;
  description: string;
  status: CaseStatus;
  ownerId: string;
  matchedTutorId?: string;
};

const cases: SeedCase[] = [
  // ── OPEN cases (drive recommendations + invite/accept demo) ──────────────
  {
    id: "00000000-0000-4000-8000-000000000201",
    title: "Weekly P5 Math tuition near Bishan",
    subject: "Math",
    level: "P5",
    location: "Bishan",
    budgetPerHour: 45,
    description:
      "My son is struggling with fractions, decimals, and word problems in Primary 5 Math. " +
      "Looking for a patient tutor who can make concepts concrete before drilling exam techniques. " +
      "Prefer weekday evenings, 1.5 h per session.",
    status: CaseStatus.OPEN,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    title: "JC1 H2 Physics intensive revision",
    subject: "Physics",
    level: "JC1",
    location: "Clementi",
    budgetPerHour: 70,
    description:
      "My daughter just entered JC1 and is finding H2 Physics significantly harder than O-Level. " +
      "She needs help bridging the gap in mechanics and waves before mid-years. " +
      "Ideally 2 sessions per week, 2 h each.",
    status: CaseStatus.OPEN,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    title: "O-Level Chemistry crash course",
    subject: "Chemistry",
    level: "S4",
    location: "Serangoon",
    budgetPerHour: 55,
    description:
      "Secondary 4 student aiming for a distinction in Pure Chemistry. " +
      "Weak spots: organic chemistry, electrolysis, and qualitative analysis. " +
      "Need a tutor who can fast-track revision to exam-ready standard within 8 weeks.",
    status: CaseStatus.OPEN,
    ownerId: parents[1].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000208",
    title: "P6 Math problem sums — PSLE focused",
    subject: "Math",
    level: "P6",
    location: "Hougang",
    budgetPerHour: 50,
    description:
      "PSLE year — my daughter is confident in basic operations but freezes on multi-step " +
      "problem sums involving ratios and percentages. Need structured practice and exam strategy.",
    status: CaseStatus.OPEN,
    ownerId: parents[1].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000209",
    title: "Secondary 2 English comprehension and composition",
    subject: "English",
    level: "S2",
    location: "Woodlands",
    budgetPerHour: 40,
    description:
      "My son scored C6 for English last term. His main weaknesses are summary writing and " +
      "argumentative essays. Looking for a tutor who can help him improve structuring ideas " +
      "and expanding vocabulary before the year-end exam.",
    status: CaseStatus.OPEN,
    ownerId: parents[2].id,
  },
  // ── MATCHED cases (matchedTutorId set; matched tutor also has an invite) ──
  {
    id: "00000000-0000-4000-8000-000000000202",
    title: "Secondary 3 English essay coaching",
    subject: "English",
    level: "S3",
    location: "Tampines",
    budgetPerHour: 50,
    description:
      "Looking for help with argumentative and expository essay writing for Secondary 3 English. " +
      "My child needs to improve paragraph structure and use of evidence. " +
      "Weekly 1-hour sessions preferred on weekends.",
    status: CaseStatus.MATCHED,
    ownerId: parents[0].id,
    matchedTutorId: tutors[1].id, // Benjamin Tan — English specialist
  },
  {
    id: "00000000-0000-4000-8000-000000000207",
    title: "O-Level Chemistry — organic focus",
    subject: "Chemistry",
    level: "S4",
    location: "Buona Vista",
    budgetPerHour: 60,
    description:
      "Student is strong in physical and inorganic chemistry but struggles with organic reactions " +
      "and functional groups. Matched with a specialist tutor to consolidate before prelims.",
    status: CaseStatus.MATCHED,
    ownerId: parents[1].id,
    matchedTutorId: tutors[4].id, // Emily Goh — Chemistry specialist
  },
  {
    id: "00000000-0000-4000-8000-000000000210",
    title: "JC2 H2 Math A-Level intensive",
    subject: "Math",
    level: "JC2",
    location: "Ang Mo Kio",
    budgetPerHour: 80,
    description:
      "JC2 student targeting an A for H2 Math. Comfortable with most topics but needs " +
      "help with statistics (probability distributions) and complex number applications. " +
      "Two sessions per week through A-Levels.",
    status: CaseStatus.MATCHED,
    ownerId: parents[2].id,
    matchedTutorId: tutors[6].id, // Grace Ng — JC Math specialist
  },
  // ── CLOSED cases ─────────────────────────────────────────────────────────
  {
    id: "00000000-0000-4000-8000-000000000204",
    title: "P3 Chinese conversational practice",
    subject: "Chinese",
    level: "P3",
    location: "Jurong East",
    budgetPerHour: 35,
    description:
      "My son needed help building confidence in spoken Mandarin for his Primary 3 oral exam. " +
      "This case has been successfully completed — the tutor helped him achieve his target grade.",
    status: CaseStatus.CLOSED,
    ownerId: parents[0].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000211",
    title: "O-Level Principles of Accounts revision",
    subject: "Accounts",
    level: "S4",
    location: "Pasir Ris",
    budgetPerHour: 48,
    description:
      "My daughter needed POA help ahead of O-Levels. The tutor covered double-entry bookkeeping " +
      "and income statements effectively. Case closed after she sat her exams.",
    status: CaseStatus.CLOSED,
    ownerId: parents[1].id,
  },
  {
    id: "00000000-0000-4000-8000-000000000213",
    title: "Secondary 1 Science foundation",
    subject: "Science",
    level: "S1",
    location: "Yishun",
    budgetPerHour: 38,
    description:
      "My son transitioned from primary to secondary school and needed help adjusting to the " +
      "integrated science syllabus covering Physics, Chemistry, and Biology basics. Case closed.",
    status: CaseStatus.CLOSED,
    ownerId: parents[2].id,
  },
  // ── Min-budget edge case ─────────────────────────────────────────────────
  {
    id: "00000000-0000-4000-8000-000000000212",
    title: "Trial session — K1 phonics starter",
    subject: "English",
    level: "K1",
    location: "Online",
    budgetPerHour: 1,
    description:
      "A single trial/demo session to test the platform's minimum-budget edge case. " +
      "Budget is intentionally set to $1/hr.",
    status: CaseStatus.OPEN,
    ownerId: parents[2].id,
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
  deletedAt?: Date;
};

function tutorProfileId(tutorId: string): string {
  return tutorId; // 1:1 — we set the profile id equal to the tutor user id for determinism
}

// Soft-deleted date for the one deleted document
const DELETED_AT = new Date("2024-11-15T10:30:00.000Z");

const documents: SeedDoc[] = [
  // ── Case documents ───────────────────────────────────────────────────────
  {
    id: "00000000-0000-4000-8000-000000000301",
    storedKey: "seed-doc-case-201-brief",
    originalName: "p5-math-brief.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: parents[0].id,
    caseId: cases[0].id, // case 201 — OPEN Math
  },
  {
    // Parent-uploaded doc on case 203 (Physics OPEN) — both parent + tutor docs on same case
    id: "00000000-0000-4000-8000-000000000305",
    storedKey: "seed-doc-case-203-parent-brief",
    originalName: "jc1-physics-requirements.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: parents[0].id,
    caseId: cases[1].id, // case 203
  },
  {
    // Tutor-uploaded doc on same case 203 — exercises uploader grouping in UI
    id: "00000000-0000-4000-8000-000000000306",
    storedKey: "seed-doc-case-203-tutor3-sample",
    originalName: "chloe-physics-study-plan.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: tutors[2].id, // Chloe Lim (tutor3)
    caseId: cases[1].id, // case 203
  },
  {
    // Doc on matched case 202
    id: "00000000-0000-4000-8000-000000000307",
    storedKey: "seed-doc-case-202-essay-guide",
    originalName: "s3-english-essay-guide.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: tutors[1].id, // Benjamin Tan — matched tutor on case 202
    caseId: cases[5].id, // case 202
  },
  {
    // Doc on matched case 207
    id: "00000000-0000-4000-8000-000000000308",
    storedKey: "seed-doc-case-207-chem-notes",
    originalName: "organic-chemistry-notes.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: tutors[4].id, // Emily Goh — matched tutor on case 207
    caseId: cases[6].id, // case 207
  },
  {
    // Soft-deleted document — demonstrates list/download exclusion
    id: "00000000-0000-4000-8000-000000000309",
    storedKey: "seed-doc-case-205-deleted",
    originalName: "chem-worksheet-deleted.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: parents[1].id,
    caseId: cases[2].id, // case 205 — OPEN Chemistry
    deletedAt: DELETED_AT,
  },
  // ── Tutor profile documents ──────────────────────────────────────────────
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
  {
    id: "00000000-0000-4000-8000-000000000304",
    storedKey: "seed-doc-tutor3-cert",
    originalName: "chloe-pgde-cert.pdf",
    mime: "application/pdf",
    body: SAMPLE_PDF,
    uploadedById: tutors[2].id,
    tutorProfileId: tutorProfileId(tutors[2].id),
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
        description: c.description,
        status: c.status,
        ownerId: c.ownerId,
        matchedTutorId: c.matchedTutorId ?? null,
      },
      create: {
        id: c.id,
        title: c.title,
        subject: c.subject,
        level: c.level,
        location: c.location,
        budgetPerHour: c.budgetPerHour,
        description: c.description,
        status: c.status,
        ownerId: c.ownerId,
        matchedTutorId: c.matchedTutorId ?? null,
      },
    });
  }
  console.log(`seeded ${cases.length} cases`);

  // Invites
  //   Matched cases: matched tutor MUST have an invite row (accept implies prior invite)
  //   Open cases: several invited-but-not-yet-accepted tutors (drives invited-tutors list + accept button)
  const invites: Array<{ caseId: string; tutorId: string }> = [
    // ── Matched case 202 (English S3) ──
    { caseId: cases[5].id, tutorId: tutors[1].id }, // Benjamin — matched tutor
    { caseId: cases[5].id, tutorId: tutors[9].id }, // James Koh — also invited (generalist)
    // ── Matched case 207 (Chemistry S4) ──
    { caseId: cases[6].id, tutorId: tutors[4].id }, // Emily — matched tutor
    { caseId: cases[6].id, tutorId: tutors[2].id }, // Chloe — also invited
    // ── Matched case 210 (JC2 H2 Math) ──
    { caseId: cases[7].id, tutorId: tutors[6].id }, // Grace — matched tutor
    { caseId: cases[7].id, tutorId: tutors[0].id }, // Aisha — also invited
    // ── Open case 201 (P5 Math) ──
    { caseId: cases[0].id, tutorId: tutors[0].id }, // Aisha — Math specialist
    { caseId: cases[0].id, tutorId: tutors[6].id }, // Grace — JC Math but also invited
    // ── Open case 203 (JC1 H2 Physics) ──
    { caseId: cases[1].id, tutorId: tutors[2].id }, // Chloe — Physics specialist
    { caseId: cases[1].id, tutorId: tutors[7].id }, // Hassan — Physics specialist
    // ── Open case 205 (O-Level Chemistry) ──
    { caseId: cases[2].id, tutorId: tutors[4].id }, // Emily — Chemistry specialist
    // ── Open case 208 (P6 Math PSLE) ──
    { caseId: cases[3].id, tutorId: tutors[0].id }, // Aisha — Math specialist
    { caseId: cases[3].id, tutorId: tutors[6].id }, // Grace — Math specialist
    // ── Open case 209 (S2 English) ──
    { caseId: cases[4].id, tutorId: tutors[1].id }, // Benjamin — English specialist
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
        deletedAt: d.deletedAt ?? null,
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
        deletedAt: d.deletedAt ?? null,
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
