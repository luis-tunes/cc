import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBankTransactions,
  uploadBankCSV,
  deleteBankTransaction,
  fetchEnrichedMovements,
  fetchDuplicateMovements,
  classifyAllMovements,
  updateBankTransaction,
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
      const msg = data.skipped
        ? `${data.imported} importados, ${data.skipped} duplicados ignorados`
        : `${data.imported} movimentos importados`;
      toast.success(msg);
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

export function useClassifyAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: classifyAllMovements,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast.success(`${data.classified} de ${data.total} movimentos classificados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao classificar: ${err.message}`);
    },
  });
}

export function useUpdateBankTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; category?: string | null; snc_account?: string | null; entity_nif?: string | null }) =>
      updateBankTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast.success("Classificação atualizada");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}
