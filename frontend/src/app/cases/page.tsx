"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { CaseStatus } from "@/lib/api-types";
import { useAuth } from "@/lib/use-auth";
import { useCases } from "@/lib/use-cases";
import Link from "next/link";
import { useState } from "react";

const STATUSES: (CaseStatus | "")[] = ["", "OPEN", "MATCHED", "CLOSED"];
const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function CasesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useCases({
    page,
    q: q || undefined,
    status: status || undefined,
  });

  const isTutor = user?.role === "TUTOR";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">{isTutor ? "My invitations" : "Cases"}</h1>
          {isTutor && (
            <p className="text-muted-foreground text-sm">Cases you have been invited to.</p>
          )}
        </div>
        {user?.role === "PARENT" && (
          <Button asChild>
            <Link href="/cases/new">New case</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search cases"
          placeholder="Search by title…"
          className={inputClass}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter by status"
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CaseStatus | "");
            setPage(1);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load cases." onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState
          title={isTutor ? "No invitations yet" : "No cases found"}
          hint={
            isTutor
              ? "When a parent invites you to a case, it will appear here."
              : "Try adjusting your search or filters."
          }
        />
      )}

      {data && data.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex items-center justify-between rounded-md border p-4 hover:bg-accent"
              >
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-muted-foreground text-sm">
                    {c.subject} · {c.level} · {c.location}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs uppercase">{c.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
