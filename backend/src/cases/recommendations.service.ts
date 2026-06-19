import { Injectable } from "@nestjs/common";
import type { Case } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RecommendationDto } from "./dto/recommendation.dto";

const MAX_RECOMMENDATIONS = 5;
const SUBJECT_MATCH_WEIGHT = 5;
const TOKEN_OVERLAP_WEIGHT = 1;

/**
 * MOCK best-match recommendation engine.
 *
 * Deterministic, no-network heuristic: scores tutor profiles by case-insensitive
 * token overlap between the case (subject/level/title/description) and the tutor's
 * qualifications, experiences, and display name. Subject matches weigh highest.
 * This is NOT a real LLM — purely local scoring.
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(caseRecord: Case): Promise<RecommendationDto[]> {
    const [profiles, invites] = await Promise.all([
      this.prisma.tutorProfile.findMany({
        select: {
          displayName: true,
          qualifications: true,
          experiences: true,
          user: { select: { id: true } },
        },
      }),
      this.prisma.caseInvite.findMany({
        where: { caseId: caseRecord.id },
        select: { tutorId: true },
      }),
    ]);

    if (profiles.length === 0) {
      return [];
    }

    const invitedTutorIds = new Set(invites.map((invite) => invite.tutorId));
    const caseTokens = tokenize(
      [caseRecord.level, caseRecord.title, caseRecord.description ?? ""].join(" "),
    );
    const subjectTokens = tokenize(caseRecord.subject);

    const scored = profiles.map((profile) => {
      const profileTokens = tokenize(
        [...profile.qualifications, ...profile.experiences, profile.displayName].join(" "),
      );
      const score = scoreOverlap(subjectTokens, caseTokens, profileTokens);
      return {
        tutorId: profile.user.id,
        displayName: profile.displayName,
        qualifications: profile.qualifications,
        score,
        alreadyInvited: invitedTutorIds.has(profile.user.id),
      } satisfies RecommendationDto;
    });

    scored.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

    return scored.slice(0, MAX_RECOMMENDATIONS);
  }
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0),
  );
}

function scoreOverlap(
  subjectTokens: Set<string>,
  caseTokens: Set<string>,
  profileTokens: Set<string>,
): number {
  let score = 0;
  for (const token of subjectTokens) {
    if (profileTokens.has(token)) {
      score += SUBJECT_MATCH_WEIGHT;
    }
  }
  for (const token of caseTokens) {
    if (profileTokens.has(token)) {
      score += TOKEN_OVERLAP_WEIGHT;
    }
  }
  return score;
}
