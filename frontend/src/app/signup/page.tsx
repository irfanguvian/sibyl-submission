"use client";

import { Button } from "@/components/ui/button";
import { type SignupValues, signupSchema } from "@/lib/schemas";
import { RegisterError, useAuth } from "@/lib/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function SignupPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", role: "PARENT", displayName: "" },
  });

  const role = watch("role");

  async function onSubmit(values: SignupValues) {
    try {
      await registerUser.mutateAsync({
        email: values.email,
        password: values.password,
        role: values.role,
        displayName: values.role === "TUTOR" ? values.displayName : undefined,
      });
      router.push("/login?registered=1");
    } catch (err) {
      if (err instanceof RegisterError && err.status === 409) {
        setError("email", { type: "manual", message: "That email is already registered." });
      }
      // other errors surfaced via the alert below
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          Parents post cases and invite tutors. Tutors build a profile and get invited.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-label="Sign up">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input type="email" autoComplete="email" className={inputClass} {...register("email")} />
          {errors.email && <span className="text-destructive text-xs">{errors.email.message}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register("password")}
          />
          {errors.password && (
            <span className="text-destructive text-xs">{errors.password.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          I am a
          <select className={inputClass} {...register("role")}>
            <option value="PARENT">Parent</option>
            <option value="TUTOR">Tutor</option>
          </select>
          {errors.role && <span className="text-destructive text-xs">{errors.role.message}</span>}
        </label>

        {role === "TUTOR" && (
          <label className="flex flex-col gap-1 text-sm">
            Display name
            <input className={inputClass} {...register("displayName")} />
            {errors.displayName && (
              <span className="text-destructive text-xs">{errors.displayName.message}</span>
            )}
          </label>
        )}

        {registerUser.isError &&
          !(registerUser.error instanceof RegisterError && registerUser.error.status === 409) && (
            <p role="alert" className="text-destructive text-sm">
              {(registerUser.error as Error).message}
            </p>
          )}

        <Button type="submit" disabled={registerUser.isPending}>
          {registerUser.isPending ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
