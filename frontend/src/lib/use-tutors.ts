"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ProfileInput, tutorsApi } from "./api";

export function useDirectory(params: { page?: number; q?: string }) {
  return useQuery({
    queryKey: ["tutors", params],
    queryFn: () => tutorsApi.directory(params),
    placeholderData: (prev) => prev,
  });
}

export function useTutorProfile(id: string) {
  return useQuery({
    queryKey: ["tutor", id],
    queryFn: () => tutorsApi.get(id),
    enabled: !!id,
  });
}

export function useOwnProfile() {
  return useQuery({
    queryKey: ["tutor", "me"],
    queryFn: () => tutorsApi.getOwn(),
    retry: false,
  });
}

export function useUpsertOwnProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => tutorsApi.upsertOwn(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutor", "me"] }),
  });
}
