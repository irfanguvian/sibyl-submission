"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { LoadingState } from "@/components/states";
import { useAuth } from "@/lib/use-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Routes that render without the dashboard shell or an auth requirement. */
const PUBLIC_PREFIXES = ["/login", "/signup"];
/** Exact public routes (no prefix matching). */
const PUBLIC_EXACT = ["/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Client-side auth boundary. Public routes (login) render bare. Everything else
 * requires a session: while loading we show a spinner, and an unauthenticated
 * user is redirected to /login (belt-and-suspenders with `middleware.ts`, which
 * also catches the cookie-absent case at the edge before any 401 is issued).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const onPublic = isPublic(pathname);

  useEffect(() => {
    if (!onPublic && !isLoading && !user) {
      router.replace("/login");
    }
  }, [onPublic, isLoading, user, router]);

  if (onPublic) {
    return <>{children}</>;
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <LoadingState />
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      userRole={user.role}
      email={user.email}
      onLogout={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
    >
      {children}
    </DashboardShell>
  );
}
