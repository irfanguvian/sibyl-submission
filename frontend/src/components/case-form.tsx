"use client";

import { Button } from "@/components/ui/button";
import { type CaseFormValues, caseFormSchema } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";

export function CaseForm({
  defaultValues,
  onSubmit,
  submitting,
  error,
  submitLabel = "Save",
}: {
  defaultValues?: Partial<CaseFormValues>;
  onSubmit: (values: CaseFormValues) => void;
  submitting?: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      title: "",
      subject: "",
      level: "",
      location: "",
      budgetPerHour: 0,
      description: "",
      ...defaultValues,
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-lg flex-col gap-4"
      aria-label="Case form"
    >
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input className={inputClass} {...register("title")} />
        {errors.title && <span className="text-destructive text-xs">{errors.title.message}</span>}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Subject
          <input className={inputClass} {...register("subject")} />
          {errors.subject && (
            <span className="text-destructive text-xs">{errors.subject.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Level
          <input className={inputClass} {...register("level")} />
          {errors.level && <span className="text-destructive text-xs">{errors.level.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Location
          <input className={inputClass} {...register("location")} />
          {errors.location && (
            <span className="text-destructive text-xs">{errors.location.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Budget / hour
          <input type="number" className={inputClass} {...register("budgetPerHour")} />
          {errors.budgetPerHour && (
            <span className="text-destructive text-xs">{errors.budgetPerHour.message}</span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          rows={4}
          maxLength={2000}
          placeholder="What does your child need help with? Goals, schedule, anything tutors should know."
          className={inputClass}
          {...register("description")}
        />
        {errors.description && (
          <span className="text-destructive text-xs">{errors.description.message}</span>
        )}
      </label>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
