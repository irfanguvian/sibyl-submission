import { z } from "zod";

/** Case create/edit form. Mirrors the backend CreateCaseDto constraints. */
export const caseFormSchema = z.object({
  title: z.string().min(3, "At least 3 characters").max(200),
  subject: z.string().min(1, "Required").max(100),
  level: z.string().min(1, "Required").max(100),
  location: z.string().min(1, "Required").max(200),
  budgetPerHour: z.coerce.number().int("Whole number").min(1, "Must be ≥ 1"),
  description: z.string().max(2000, "At most 2000 characters").optional(),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

/** Signup form. Mirrors the backend RegisterDto; displayName is for tutors. */
export const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters").max(128),
    role: z.enum(["PARENT", "TUTOR"], { message: "Choose a role" }),
    displayName: z.string().max(120).optional(),
  })
  .refine((v) => v.role !== "TUTOR" || (v.displayName?.trim().length ?? 0) >= 2, {
    message: "At least 2 characters",
    path: ["displayName"],
  });

export type SignupValues = z.infer<typeof signupSchema>;

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
