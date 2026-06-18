"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginCredentials } from "./api-types";

export const AUTH_ME_KEY = ["auth", "me"] as const;

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Failed to load session");
  }
  return (await res.json()) as AuthUser;
}

/** Auth state + login/logout mutations, all routed through the BFF. */
export function useAuth() {
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 30_000,
  });

  const login = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Invalid email or password");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY }),
  });

  const logout = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => queryClient.setQueryData(AUTH_ME_KEY, null),
  });

  return {
    user: session.data ?? null,
    isLoading: session.isLoading,
    isError: session.isError,
    login,
    logout,
  };
}
