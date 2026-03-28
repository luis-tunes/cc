import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBankTransactions,
  uploadBankCSV,
  deleteBankTransaction,
  fetchEnrichedMovements,
  fetchDuplicateMovements,
  type BankTransaction,
  type EnrichedMovement,
} from "@/lib/api";
import { toast } from "sonner";

export type { BankTransaction, EnrichedMovement };

export function useBankTransactions() {
  return useQuery<BankTransaction[]>({
    queryKey: ["bank-transactions"],
    queryFn: () => fetchBankTransactions(),
  });
}

export function useEnrichedMovements() {
  return useQuery<EnrichedMovement[]>({
    queryKey: ["bank-transactions", "enriched"],
    queryFn: fetchEnrichedMovements,
  });
}

export function useDuplicateMovements() {
  return useQuery<any[]>({
    queryKey: ["bank-transactions", "duplicates"],
    queryFn: fetchDuplicateMovements,
  });
}

export function useUploadBankCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadBankCSV,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reconciliations"] });
      toast.success(`${data.imported} movimentos importados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao importar CSV: ${err.message}`);
    },
  });
}

export function useDeleteBankTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBankTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reconciliations"] });
      toast.success("Movimento eliminado");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao eliminar: ${err.message}`);
    },
  });
}
