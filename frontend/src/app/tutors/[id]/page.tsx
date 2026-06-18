"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useTutorProfile } from "@/lib/use-tutors";
import { useParams } from "next/navigation";

export default function TutorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useTutorProfile(id);

  if (isLoading) {
    return <LoadingState />;
  }
  if (isError || !data) {
    return (
      <ErrorState
        message="This profile is unavailable — it may not exist or you may not have access."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">{data.displayName}</h1>

      <section>
        <h2 className="font-medium text-lg">Qualifications</h2>
        {data.qualifications.length === 0 ? (
          <EmptyState title="None listed" />
        ) : (
          <ul className="list-inside list-disc text-sm">
            {data.qualifications.map((qline) => (
              <li key={qline}>{qline}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium text-lg">Experience</h2>
        {data.experiences.length === 0 ? (
          <EmptyState title="None listed" />
        ) : (
          <ul className="list-inside list-disc text-sm">
            {data.experiences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
