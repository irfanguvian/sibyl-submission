"use client";

import { FileDropzone } from "@/components/file-dropzone";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { casesApi, uploadDocument } from "@/lib/api";
import type { DocumentMeta } from "@/lib/api-types";
import { useDeleteCaseDocument } from "@/lib/use-cases";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type DocumentsQuery = {
  data?: DocumentMeta[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

type UploadEntry = {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

export function CaseDocuments({
  caseId,
  ownerId,
  documents,
  canUpload,
  canDeleteDocument,
}: {
  caseId: string;
  ownerId?: string;
  documents: DocumentsQuery;
  canUpload: boolean;
  canDeleteDocument?: (doc: DocumentMeta) => boolean;
}) {
  const qc = useQueryClient();
  const remove = useDeleteCaseDocument(caseId);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    setBusy(true);
    setUploads(files.map((f) => ({ name: f.name, status: "uploading" })));

    await Promise.all(
      files.map(async (file, i) => {
        try {
          await uploadDocument(`/cases/${caseId}/documents`, file);
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: "done" } : u)));
        } catch (err) {
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: "error", error: (err as Error).message } : u,
            ),
          );
        }
      }),
    );

    setBusy(false);
    qc.invalidateQueries({ queryKey: ["case", caseId, "documents"] });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-lg">Documents</h2>
      {documents.isLoading && <LoadingState rows={2} />}
      {documents.isError && (
        <ErrorState message="Could not load documents." onRetry={() => documents.refetch()} />
      )}
      {documents.data && documents.data.length === 0 && <EmptyState title="No documents yet" />}

      {documents.data && documents.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {documents.data.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">{d.originalName}</span>
                <span className="text-muted-foreground text-xs">
                  {d.uploadedById === ownerId ? "by Parent" : `by ${d.uploaderName ?? "tutor"}`}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <a
                  className="text-primary text-sm underline-offset-4 hover:underline"
                  href={casesApi.downloadUrl(d.id)}
                >
                  Download
                </a>
                {canDeleteDocument?.(d) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(d.id)}
                  >
                    Delete
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {remove.isError && (
        <p role="alert" className="text-destructive text-sm">
          Could not delete that document.
        </p>
      )}

      {canUpload && (
        <div className="flex flex-col gap-3">
          <FileDropzone multiple onFiles={handleFiles} disabled={busy} />
          {uploads.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm" aria-label="Upload progress">
              {uploads.map((u) => (
                <li key={u.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  <span
                    className={
                      u.status === "error"
                        ? "text-destructive text-xs"
                        : u.status === "done"
                          ? "text-green-600 text-xs"
                          : "text-muted-foreground text-xs"
                    }
                  >
                    {u.status === "uploading"
                      ? "Uploading…"
                      : u.status === "done"
                        ? "Uploaded"
                        : "Failed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
