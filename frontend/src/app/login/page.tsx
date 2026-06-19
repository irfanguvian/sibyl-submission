"use client";

import { Button } from "@/components/ui/button";
import type { LoginCredentials } from "@/lib/api-types";
import { useAuth } from "@/lib/use-auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Seeded demo accounts (see backend/prisma/seed.ts). Only surfaced when
// NEXT_PUBLIC_DEMO_MODE === "true" for manual testing in a deployed env.
const DEMO_PASSWORD = "password123";
const DEMO_ACCOUNTS: Record<"PARENT" | "TUTOR", LoginCredentials> = {
  PARENT: { email: "parent@example.com", password: DEMO_PASSWORD },
  TUTOR: { email: "tutor1@example.com", password: DEMO_PASSWORD },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function signIn(credentials: LoginCredentials) {
    try {
      await login.mutateAsync(credentials);
      router.push("/cases");
    } catch {
      // error surfaced via login.isError below
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn({ email, password });
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Sign in</h1>
        <p className="text-muted-foreground text-sm">Use your tuition marketplace account.</p>
      </div>

      {justRegistered && (
        <output className="rounded-md border border-green-600/40 bg-green-600/5 p-3 text-green-700 text-sm">
          Account created — sign in to continue.
        </output>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Sign in">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        {login.isError && (
          <p role="alert" className="text-destructive text-sm">
            Invalid email or password.
          </p>
        )}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demoMode && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-muted-foreground text-xs">Demo mode — quick sign-in:</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={login.isPending}
              onClick={() => signIn(DEMO_ACCOUNTS.PARENT)}
            >
              Sign in as Parent
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={login.isPending}
              onClick={() => signIn(DEMO_ACCOUNTS.TUTOR)}
            >
              Sign in as Tutor
            </Button>
          </div>
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        New here?{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
