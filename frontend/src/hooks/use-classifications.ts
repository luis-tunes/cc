import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClassificationRules,
  createClassificationRule,
  patchClassificationRule,
  deleteClassificationRule,
  type ClassificationRule,
  type ClassificationRuleCreate,
} from "@/lib/api";

export function useClassificationRules() {
  return useQuery<ClassificationRule[]>({
    queryKey: ["classification-rules"],
    queryFn: fetchClassificationRules,
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
