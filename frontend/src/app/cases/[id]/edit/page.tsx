"use client";

import { CaseForm } from "@/components/case-form";
import { ErrorState, LoadingState } from "@/components/states";
import { useCase, useUpdateCase } from "@/lib/use-cases";
import { useParams, useRouter } from "next/navigation";

export default function EditCasePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: caseItem, isLoading, isError, refetch } = useCase(id);
  const update = useUpdateCase(id);

  if (isLoading) {
    return <LoadingState />;
  }
  if (isError || !caseItem) {
    return <ErrorState message="Could not load this case." onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Edit case</h1>
      <CaseForm
        submitLabel="Save changes"
        submitting={update.isPending}
        error={update.isError ? "Could not save changes." : null}
        defaultValues={{
          title: caseItem.title,
          subject: caseItem.subject,
          level: caseItem.level,
          location: caseItem.location,
          budgetPerHour: caseItem.budgetPerHour,
        }}
        onSubmit={async (values) => {
          await update.mutateAsync(values);
          router.push(`/cases/${id}`);
        }}
      />
    </div>
  );
}
