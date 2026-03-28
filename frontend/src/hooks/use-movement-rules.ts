import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMovementRules,
  createMovementRule,
  deleteMovementRule,
  type MovementRule,
} from "@/lib/api";
import { toast } from "sonner";

export function useMovementRules() {
  return useQuery<MovementRule[]>({
    queryKey: ["movement-rules"],
    queryFn: fetchMovementRules,
  });
}

export function useCreateMovementRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<MovementRule, "id">) => createMovementRule(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement-rules"] });
      qc.invalidateQueries({ queryKey: ["bank-transactions", "enriched"] });
      toast.success("Regra criada");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar regra: ${err.message}`);
    },
  });
}

export function useDeleteMovementRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMovementRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movement-rules"] });
      qc.invalidateQueries({ queryKey: ["bank-transactions", "enriched"] });
      toast.success("Regra eliminada");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao eliminar regra: ${err.message}`);
    },
  });
}
