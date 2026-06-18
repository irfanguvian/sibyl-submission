import { z } from "zod";

/** Case create/edit form. Mirrors the backend CreateCaseDto constraints. */
export const caseFormSchema = z.object({
  title: z.string().min(3, "At least 3 characters").max(200),
  subject: z.string().min(1, "Required").max(100),
  level: z.string().min(1, "Required").max(100),
  location: z.string().min(1, "Required").max(200),
  budgetPerHour: z.coerce.number().int("Whole number").min(0, "Must be ≥ 0"),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

/**
 * Tutor profile form. Qualifications and experiences are entered as one item per
 * line in a textarea, then split into arrays on submit.
 */
export const profileFormSchema = z.object({
  displayName: z.string().min(2, "At least 2 characters").max(120),
  qualifications: z.string().max(5000),
  experiences: z.string().max(5000),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
