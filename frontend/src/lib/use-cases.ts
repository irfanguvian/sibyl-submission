"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type CaseInput, type CaseListParams, casesApi } from "./api";
import type { CaseStatus } from "./api-types";

export function useCases(params: CaseListParams) {
  return useQuery({
    queryKey: ["cases", params],
    queryFn: () => casesApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCase(id: string) {
  return useQuery({ queryKey: ["case", id], queryFn: () => casesApi.get(id), enabled: !!id });
}

export function useCaseDocuments(id: string) {
  return useQuery({
    queryKey: ["case", id, "documents"],
    queryFn: () => casesApi.listDocuments(id),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseInput) => casesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }),
  });
}

export function useUpdateCase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CaseInput & { status: CaseStatus }>) => casesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useCaseInvites(id: string, enabled = true) {
  return useQuery({
    queryKey: ["case", id, "invites"],
    queryFn: () => casesApi.listInvites(id),
    enabled: !!id && enabled,
  });
}

export function useRecommendations(id: string, enabled = true) {
  return useQuery({
    queryKey: ["case", id, "recommendations"],
    queryFn: () => casesApi.recommendations(id),
    enabled: !!id && enabled,
  });
}

export function useInviteTutor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tutorId: string) => casesApi.invite(id, tutorId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["case", id] });
      await qc.invalidateQueries({ queryKey: ["case", id, "invites"] });
      await qc.invalidateQueries({ queryKey: ["case", id, "recommendations"] });
      await qc.refetchQueries({ queryKey: ["case", id, "invites"] });
    },
  });
}

export function useRevokeInvite(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tutorId: string) => casesApi.revokeInvite(id, tutorId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["case", id] });
      await qc.invalidateQueries({ queryKey: ["case", id, "invites"] });
      await qc.invalidateQueries({ queryKey: ["case", id, "recommendations"] });
      await qc.refetchQueries({ queryKey: ["case", id, "invites"] });
    },
  });
}

export function useAcceptTutor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tutorId: string) => casesApi.accept(id, tutorId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["case", id] });
      await qc.invalidateQueries({ queryKey: ["case", id, "invites"] });
      await qc.invalidateQueries({ queryKey: ["case", id, "recommendations"] });
      await qc.invalidateQueries({ queryKey: ["cases"] });
      await qc.refetchQueries({ queryKey: ["case", id, "invites"] });
    },
  });
}

export function useDeleteCaseDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => casesApi.deleteDocument(id, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id, "documents"] }),
  });
}
