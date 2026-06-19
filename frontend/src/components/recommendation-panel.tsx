"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useInviteTutor, useRecommendations } from "@/lib/use-cases";
import { Sparkles } from "lucide-react";

/**
 * AI-suggested (mock) tutor matches for a case. Shows a ranked list with score
 * and an Invite shortcut; tutors already invited are flagged and not re-invited.
 */
export function RecommendationPanel({ caseId }: { caseId: string }) {
  const recs = useRecommendations(caseId);
  const invite = useInviteTutor(caseId);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-medium text-lg">Suggested tutors</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
          AI-suggested (mock)
        </span>
      </div>

      {recs.isLoading && <LoadingState rows={2} />}
      {recs.isError && (
        <ErrorState message="Could not load suggestions." onRetry={() => recs.refetch()} />
      )}
      {recs.data && recs.data.length === 0 && (
        <EmptyState title="No suggestions yet" hint="Add a description to improve matches." />
      )}

      {recs.data && recs.data.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Suggested tutors">
          {recs.data.map((r, i) => (
            <li
              key={r.tutorId}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <span>
                <span className="font-medium text-sm">
                  {i + 1}. {r.displayName}
                  <span className="ml-2 text-muted-foreground text-xs">score {r.score}</span>
                </span>
                <span className="block text-muted-foreground text-xs">
                  {r.qualifications.slice(0, 2).join(", ") || "No qualifications listed"}
                </span>
              </span>
              {r.alreadyInvited ? (
                <span className="text-muted-foreground text-xs">Already invited</span>
              ) : (
                <Button
                  size="sm"
                  disabled={invite.isPending}
                  onClick={() => invite.mutate(r.tutorId)}
                >
                  Invite
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
