"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/lib/use-auth";
import { useDirectory } from "@/lib/use-tutors";
import Link from "next/link";
import { useState } from "react";

export default function TutorsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useDirectory({ page, q: q || undefined });

  if (user && user.role !== "PARENT") {
    return (
      <EmptyState
        title="Directory is parents-only"
        hint="Tutors manage their own profile from the Profile page."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Tutor directory</h1>
      <input
        aria-label="Search tutors"
        placeholder="Search by name…"
        className="max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load the directory." onRetry={() => refetch()} />}
      {data && data.data.length === 0 && <EmptyState title="No tutors found" />}

      {data && data.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.data.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tutors/${t.id}`}
                className="block rounded-md border p-4 hover:bg-accent"
              >
                <span className="font-medium">{t.displayName}</span>
                <span className="block text-muted-foreground text-sm">
                  {t.qualifications.slice(0, 2).join(", ") || "No qualifications listed"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
