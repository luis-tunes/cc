import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClassificationRules,
  createClassificationRule,
  patchClassificationRule,
  deleteClassificationRule,
  fetchClassificationStats,
  runAutoClassify,
  type ClassificationRule,
  type ClassificationRuleCreate,
  type ClassificationStats,
} from "@/lib/api";

export function useClassificationRules() {
  return useQuery<ClassificationRule[]>({
    queryKey: ["classification-rules"],
    queryFn: fetchClassificationRules,
  });
}

export function useClassificationStats() {
  return useQuery<ClassificationStats>({
    queryKey: ["classification-stats"],
    queryFn: fetchClassificationStats,
  });
}

export function useAutoClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAutoClassify,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classification-stats"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useCreateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClassificationRuleCreate) => createClassificationRule(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classification-rules"] }),
  });
}

export function useUpdateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ClassificationRuleCreate> }) =>
      patchClassificationRule(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classification-rules"] }),
  });
}

export function useDeleteClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteClassificationRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classification-rules"] }),
  });
}
