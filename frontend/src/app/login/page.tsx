"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      router.push("/");
    } catch {
      // error surfaced via login.isError below
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Sign in</h1>
        <p className="text-muted-foreground text-sm">Use your tuition marketplace account.</p>
      </div>

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
    </div>
  );
}
