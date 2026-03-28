import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReconciliations,
  runReconciliation,
  patchReconciliation,
  fetchReconciliationSuggestions,
  type Reconciliation,
} from "@/lib/api";
import { toast } from "sonner";

export type { Reconciliation };

export function useReconciliations() {
  return useQuery<Reconciliation[]>({
    queryKey: ["reconciliations"],
    queryFn: fetchReconciliations,
  });
}

export function useReconciliationSuggestions(docId: number | null) {
  return useQuery({
    queryKey: ["reconciliations", "suggestions", docId],
    queryFn: () => fetchReconciliationSuggestions(docId!),
    enabled: docId != null,
  });
}

export function useRunReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runReconciliation,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["reconciliations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`${data.matched} matches encontrados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro na reconciliação: ${err.message}`);
    },
  });
}

export function usePatchReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patchReconciliation(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliations"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}
