"use client";

import { FileDropzone } from "@/components/file-dropzone";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { casesApi, uploadDocument } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useCase, useCaseDocuments, useInviteTutor, useRevokeInvite } from "@/lib/use-cases";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: caseItem, isLoading, isError, refetch } = useCase(id);
  const docs = useCaseDocuments(id);
  const invite = useInviteTutor(id);
  const revoke = useRevokeInvite(id);
  const [tutorId, setTutorId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dropzoneKey, setDropzoneKey] = useState(0);

  const upload = useMutation({
    mutationFn: (f: File) => uploadDocument(`/cases/${id}/documents`, f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id, "documents"] }),
  });

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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-2xl">{caseItem.title}</h1>
          <p className="text-muted-foreground text-sm">
            {caseItem.subject} · {caseItem.level} · {caseItem.location} · £{caseItem.budgetPerHour}
            /hr · <span className="uppercase">{caseItem.status}</span>
          </p>
        </div>
        {isOwner && (
          <Button asChild variant="outline">
            <Link href={`/cases/${id}/edit`}>Edit</Link>
          </Button>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-lg">Documents</h2>
        {docs.isLoading && <LoadingState rows={2} />}
        {docs.isError && (
          <ErrorState message="Could not load documents." onRetry={() => docs.refetch()} />
        )}
        {docs.data && docs.data.length === 0 && <EmptyState title="No documents yet" />}
        {docs.data && docs.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">{d.originalName}</span>
                <a
                  className="text-primary text-sm underline-offset-4 hover:underline"
                  href={casesApi.downloadUrl(d.id)}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          <FileDropzone key={dropzoneKey} onFile={setFile} disabled={upload.isPending} />
          <Button
            size="sm"
            className="self-start"
            disabled={!file || upload.isPending}
            onClick={() => {
              if (file) {
                upload.mutate(file, {
                  onSuccess: () => {
                    setFile(null);
                    setDropzoneKey((k) => k + 1);
                  },
                });
              }
            }}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {upload.isError && (
          <p role="alert" className="text-destructive text-sm">
            Upload failed — check the file type (pdf/docx/png/jpg) and size (≤ 10 MB).
          </p>
        )}
      </section>

      {isOwner && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-lg">Invite a tutor</h2>
          <div className="flex items-center gap-3">
            <input
              aria-label="Tutor id"
              placeholder="Tutor id"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tutorId}
              onChange={(e) => setTutorId(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!tutorId || invite.isPending}
              onClick={() => invite.mutate(tutorId, { onSuccess: () => setTutorId("") })}
            >
              Invite
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!tutorId || revoke.isPending}
              onClick={() => revoke.mutate(tutorId)}
            >
              Revoke
            </Button>
          </div>
          {invite.isError && (
            <p role="alert" className="text-destructive text-sm">
              Could not invite that tutor.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Enter a tutor id to invite or revoke their access to this case.
          </p>
        </section>
      )}
    </div>
  );
}
