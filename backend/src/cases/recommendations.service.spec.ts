import type { Case } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationsService } from "./recommendations.service";

type ProfileRow = {
  displayName: string;
  qualifications: string[];
  experiences: string[];
  user: { id: string };
};

function makePrisma() {
  return {
    tutorProfile: { findMany: vi.fn() },
    caseInvite: { findMany: vi.fn() },
  };
}

function profile(over: Partial<ProfileRow> & { id: string }): ProfileRow {
  return {
    displayName: over.displayName ?? over.id,
    qualifications: over.qualifications ?? [],
    experiences: over.experiences ?? [],
    user: { id: over.id },
  };
}

function makeCase(over: Partial<Case> = {}): Case {
  return {
    id: "case-1",
    title: "Need help",
    subject: "Mathematics",
    level: "GCSE",
    location: "London",
    budgetPerHour: 40,
    description: null,
    status: "OPEN",
    ownerId: "parent-1",
    matchedTutorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Case;
}

describe("RecommendationsService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: RecommendationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    prisma.caseInvite.findMany.mockResolvedValue([]);
    // biome-ignore lint/suspicious/noExplicitAny: test doubles
    service = new RecommendationsService(prisma as any);
  });

  it("returns an empty list when the tutor directory is empty", async () => {
    prisma.tutorProfile.findMany.mockResolvedValue([]);
    const result = await service.recommend(makeCase());
    expect(result).toEqual([]);
  });

  it("ranks a subject match above a mere keyword/token match", async () => {
    prisma.tutorProfile.findMany.mockResolvedValue([
      // Mentions "exam" (a case-token match worth 1) but not the subject.
      profile({ id: "token-tutor", displayName: "Token Tutor", qualifications: ["Exam coach"] }),
      // Mentions the subject "Mathematics" (worth 5).
      profile({
        id: "subject-tutor",
        displayName: "Subject Tutor",
        qualifications: ["Mathematics degree"],
      }),
    ]);

    const result = await service.recommend(
      makeCase({ subject: "Mathematics", title: "exam prep" }),
    );

    expect(result.map((r) => r.tutorId)).toEqual(["subject-tutor", "token-tutor"]);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("caps the result set at the top 5 by score", async () => {
    // 7 profiles, descending qualification-token overlap with the case tokens.
    const rows = [
      profile({ id: "t1", qualifications: ["algebra calculus geometry exam london"] }),
      profile({ id: "t2", qualifications: ["algebra calculus geometry exam"] }),
      profile({ id: "t3", qualifications: ["algebra calculus geometry"] }),
      profile({ id: "t4", qualifications: ["algebra calculus"] }),
      profile({ id: "t5", qualifications: ["algebra"] }),
      profile({ id: "t6", qualifications: ["unrelated"] }),
      profile({ id: "t7", qualifications: ["nothingmatches"] }),
    ];
    prisma.tutorProfile.findMany.mockResolvedValue(rows);

    const result = await service.recommend(
      makeCase({
        subject: "Maths",
        title: "algebra calculus geometry",
        description: "exam london",
      }),
    );

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.tutorId)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("flags tutors that are already invited to the case", async () => {
    prisma.tutorProfile.findMany.mockResolvedValue([
      profile({ id: "invited-tutor", qualifications: ["Mathematics"] }),
      profile({ id: "fresh-tutor", qualifications: ["Mathematics"] }),
    ]);
    prisma.caseInvite.findMany.mockResolvedValue([{ tutorId: "invited-tutor" }]);

    const result = await service.recommend(makeCase({ subject: "Mathematics" }));
    const byId = Object.fromEntries(result.map((r) => [r.tutorId, r]));
    expect(byId["invited-tutor"].alreadyInvited).toBe(true);
    expect(byId["fresh-tutor"].alreadyInvited).toBe(false);
  });

  it("breaks score ties deterministically by display name (ascending)", async () => {
    prisma.tutorProfile.findMany.mockResolvedValue([
      profile({ id: "z", displayName: "Zoe", qualifications: ["Mathematics"] }),
      profile({ id: "a", displayName: "Aaron", qualifications: ["Mathematics"] }),
      profile({ id: "m", displayName: "Mona", qualifications: ["Mathematics"] }),
    ]);

    const result = await service.recommend(makeCase({ subject: "Mathematics" }));
    // Equal scores → stable alphabetical tiebreak on displayName.
    expect(result.map((r) => r.displayName)).toEqual(["Aaron", "Mona", "Zoe"]);
  });

  it("includes zero-score tutors but ranks them last", async () => {
    prisma.tutorProfile.findMany.mockResolvedValue([
      profile({ id: "match", displayName: "Match", qualifications: ["Mathematics"] }),
      profile({ id: "nomatch", displayName: "NoMatch", qualifications: ["Pottery"] }),
    ]);

    const result = await service.recommend(makeCase({ subject: "Mathematics", title: "tutor" }));
    expect(result[0].tutorId).toBe("match");
    expect(result[result.length - 1].tutorId).toBe("nomatch");
    expect(result[result.length - 1].score).toBe(0);
  });
});
