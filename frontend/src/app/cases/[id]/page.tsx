"use client";

import { CaseDocuments } from "@/components/case-documents";
import { InviteTutor } from "@/components/invite-tutor";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useCase, useCaseDocuments, useUpdateCase } from "@/lib/use-cases";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: caseItem, isLoading, isError, refetch } = useCase(id);
  const docs = useCaseDocuments(id);
  const updateCase = useUpdateCase(id);

  if (isLoading) {
    return <LoadingState />;
  }
  if (isError || !caseItem) {
    return (
      <ErrorState
        message="This case is unavailable — it may not exist or you may not have access."
        onRetry={() => refetch()}
      />
    );
  }

  const isOwner = user?.role === "PARENT" && user.id === caseItem.ownerId;
  const isTutor = user?.role === "TUTOR";
  const isMatched = caseItem.status === "MATCHED";
  const isClosed = caseItem.status === "CLOSED";

  // Upload ACL matrix:
  //   owner  -> any status except CLOSED
  //   tutor  -> OPEN, or MATCHED only when they are the matched tutor
  //   CLOSED -> nobody
  const canUpload = isClosed
    ? false
    : isOwner
      ? true
      : isTutor
        ? caseItem.status === "OPEN" ||
          (caseItem.status === "MATCHED" && caseItem.matchedTutorId === user?.id)
        : false;

  function handleCloseCase() {
    if (window.confirm("Close this case? Tutors will no longer be able to upload.")) {
      updateCase.mutate({ status: "CLOSED" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl">{caseItem.title}</h1>
          <p className="text-muted-foreground text-sm">
            {caseItem.subject} · {caseItem.level} · {caseItem.location} · £{caseItem.budgetPerHour}
            /hr · <span className="uppercase">{caseItem.status}</span>
            {isMatched && (
              <span className="ml-2 rounded-full bg-green-600/10 px-2 py-0.5 text-green-700 text-xs">
                Matched
              </span>
            )}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/cases/${id}/edit`}>Edit</Link>
            </Button>
            {!isClosed && (
              <Button
                variant="destructive"
                disabled={updateCase.isPending}
                onClick={handleCloseCase}
              >
                Close case
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Brief / description — visible to anyone who can see the case (owner + invited tutors). */}
      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-lg">Brief</h2>
        {caseItem.description ? (
          <p className="whitespace-pre-wrap text-sm">{caseItem.description}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No description provided.</p>
        )}
      </section>

      <CaseDocuments
        caseId={id}
        ownerId={caseItem.ownerId}
        documents={docs}
        canUpload={canUpload}
        canDeleteDocument={(doc) => doc.uploadedById === user?.id}
      />

      {isOwner && (
        <>
          {!isMatched && !isClosed && <RecommendationPanel caseId={id} />}
          <InviteTutor caseItem={caseItem} />
        </>
      )}
    </div>
  );
}
