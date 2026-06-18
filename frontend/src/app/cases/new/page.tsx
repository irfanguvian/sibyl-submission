"use client";

import { CaseForm } from "@/components/case-form";
import { useCreateCase } from "@/lib/use-cases";
import { useRouter } from "next/navigation";

export default function NewCasePage() {
  const router = useRouter();
  const create = useCreateCase();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">New case</h1>
      <CaseForm
        submitLabel="Create"
        submitting={create.isPending}
        error={create.isError ? "Could not create the case." : null}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(values);
          router.push(`/cases/${created.id}`);
        }}
      />
    </div>
  );
}
