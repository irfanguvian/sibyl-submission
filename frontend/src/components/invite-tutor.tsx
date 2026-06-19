"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { Case } from "@/lib/api-types";
import { useAcceptTutor, useCaseInvites, useInviteTutor, useRevokeInvite } from "@/lib/use-cases";
import { useDirectory } from "@/lib/use-tutors";
import { useState } from "react";

const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";

/**
 * Owner-only invite management for a case: search the tutor directory by name and
 * invite, then accept or revoke invited tutors. Once a case is MATCHED, further
 * accepts are disabled (one tutor per case).
 */
export function InviteTutor({ caseItem }: { caseItem: Case }) {
  const caseId = caseItem.id;
  const isMatched = caseItem.status === "MATCHED";

  const [q, setQ] = useState("");
  const directory = useDirectory({ q: q.trim() ? q.trim() : undefined });
  const invites = useCaseInvites(caseId);
  const invite = useInviteTutor(caseId);
  const revoke = useRevokeInvite(caseId);
  const accept = useAcceptTutor(caseId);

  const invitedIds = new Set((invites.data ?? []).map((t) => t.tutorId));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium text-lg">Invite a tutor</h2>

      {isMatched && (
        <p className="rounded-md border border-green-600/40 bg-green-600/5 p-3 text-green-700 text-sm">
          This case is matched. A tutor has been accepted; no further accepts are allowed.
        </p>
      )}

      {/* Search the directory by name */}
      <div className="flex flex-col gap-2">
        <input
          aria-label="Search tutors by name"
          placeholder="Search tutors by name…"
          className={inputClass}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q.trim() && (
          <div className="flex flex-col gap-2">
            {directory.isLoading && <LoadingState rows={2} />}
            {directory.isError && (
              <ErrorState
                message="Could not search the directory."
                onRetry={() => directory.refetch()}
              />
            )}
            {directory.data && directory.data.data.length === 0 && (
              <EmptyState title="No tutors match that name" />
            )}
            {directory.data && directory.data.data.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="Tutor search results">
                {directory.data.data.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span>
                      <span className="font-medium text-sm">{t.displayName}</span>
                      <span className="block text-muted-foreground text-xs">
                        {t.qualifications.slice(0, 2).join(", ") || "No qualifications listed"}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      disabled={invite.isPending || invitedIds.has(t.userId)}
                      onClick={() => invite.mutate(t.userId)}
                    >
                      {invitedIds.has(t.userId) ? "Invited" : "Invite"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {invite.isError && (
          <p role="alert" className="text-destructive text-sm">
            Could not invite that tutor — they may already be invited.
          </p>
        )}
      </div>

      {/* Invited tutors */}
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Invited tutors</h3>
        {invites.isLoading && <LoadingState rows={1} />}
        {invites.isError && (
          <ErrorState message="Could not load invited tutors." onRetry={() => invites.refetch()} />
        )}
        {invites.data && invites.data.length === 0 && (
          <EmptyState title="No tutors invited yet" hint="Search above to invite one." />
        )}
        {invites.data && invites.data.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Invited tutors">
            {invites.data.map((t) => {
              const isMatchedTutor = isMatched && caseItem.matchedTutorId === t.tutorId;
              return (
                <li
                  key={t.tutorId}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span>
                    <span className="font-medium text-sm">
                      {t.displayName}
                      {isMatchedTutor && (
                        <span className="ml-2 rounded-full bg-green-600/10 px-2 py-0.5 text-green-700 text-xs">
                          Matched
                        </span>
                      )}
                    </span>
                    <span className="block text-muted-foreground text-xs">
                      {t.qualifications.slice(0, 2).join(", ") || "No qualifications listed"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={isMatched || accept.isPending}
                      onClick={() => accept.mutate(t.tutorId)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isMatched || revoke.isPending}
                      onClick={() => revoke.mutate(t.tutorId)}
                    >
                      Revoke
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {accept.isError && (
          <p role="alert" className="text-destructive text-sm">
            Could not accept that tutor — the case may already be matched.
          </p>
        )}
      </div>
    </section>
  );
}
