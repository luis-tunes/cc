import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReconciliations,
  runReconciliation,
  type Reconciliation,
} from "@/lib/api";
import { toast } from "sonner";

export function useReconciliations() {
  return useQuery<Reconciliation[]>({
    queryKey: ["reconciliations"],
    queryFn: fetchReconciliations,
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
      toast.success(`${data.new_matches} novos matches encontrados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro na reconciliação: ${err.message}`);
    },
  });
}
