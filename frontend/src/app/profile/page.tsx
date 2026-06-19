"use client";

import { FileDropzone } from "@/components/file-dropzone";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { casesApi, tutorsApi, uploadDocument } from "@/lib/api";
import { type ProfileFormValues, linesToArray, profileFormSchema } from "@/lib/schemas";
import { useAuth } from "@/lib/use-auth";
import { useOwnProfile, useUpsertOwnProfile } from "@/lib/use-tutors";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const profile = useOwnProfile();
  const upsert = useUpsertOwnProfile();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dropzoneKey, setDropzoneKey] = useState(0);

  const profileId = profile.data?.id;
  const docs = useQuery({
    queryKey: ["tutor", "me", "documents", profileId],
    queryFn: () => tutorsApi.listDocuments(profileId as string),
    enabled: !!profileId,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument("/tutor-profiles/me/documents", file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutor", "me", "documents"] }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: {
      displayName: profile.data?.displayName ?? "",
      qualifications: profile.data?.qualifications.join("\n") ?? "",
      experiences: profile.data?.experiences.join("\n") ?? "",
    },
  });

  if (authLoading) {
    return <LoadingState />;
  }
  if (user && user.role !== "TUTOR") {
    return (
      <EmptyState title="Profiles are for tutors" hint="Parents browse the directory instead." />
    );
  }
  // A missing profile (404) is the expected first-run state, not an error.
  if (profile.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-semibold text-2xl">My tutor profile</h1>

      <form
        aria-label="Profile form"
        className="flex max-w-lg flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          upsert.mutate({
            displayName: values.displayName,
            qualifications: linesToArray(values.qualifications),
            experiences: linesToArray(values.experiences),
          }),
        )}
      >
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input className={inputClass} {...register("displayName")} />
          {errors.displayName && (
            <span className="text-destructive text-xs">{errors.displayName.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Qualifications (one per line)
          <textarea rows={4} className={inputClass} {...register("qualifications")} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Experience (one per line)
          <textarea rows={4} className={inputClass} {...register("experiences")} />
        </label>
        {upsert.isError && (
          <p role="alert" className="text-destructive text-sm">
            Could not save your profile.
          </p>
        )}
        {upsert.isSuccess && <p className="text-sm text-green-600">Saved.</p>}
        <Button type="submit" disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-lg">Supporting documents</h2>
        {!profileId && <EmptyState title="Save your profile first to attach documents" />}
        {profileId && docs.isLoading && <LoadingState rows={2} />}
        {profileId && docs.isError && (
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
        {profileId && (
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
        )}
        {upload.isError && (
          <p role="alert" className="text-destructive text-sm">
            Upload failed — check the file type and size.
          </p>
        )}
      </section>
    </div>
  );
}
