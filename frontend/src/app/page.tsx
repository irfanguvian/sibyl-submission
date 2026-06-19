"use client";

import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Authed users land on the cases workspace — the primary surface for both roles.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/cases");
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <LoadingState />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-primary" />
        <span className="font-semibold text-xl">Tuition</span>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-3xl tracking-tight">Find the right tutor, faster.</h1>
        <p className="text-muted-foreground">
          Parents post a case describing what their child needs, invite qualified tutors, and review
          supporting documents in one place. Tutors build a profile and get matched to the cases
          that fit them best.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
