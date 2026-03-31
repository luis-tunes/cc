import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCustomers,
  createCustomer,
  patchCustomer,
  deleteCustomer,
  type Customer,
  type CustomerCreate,
} from "@/lib/api";
import { toast } from "sonner";

export type { Customer, CustomerCreate };

export function useCustomers(search?: string, activeOnly = true) {
  return useQuery<Customer[]>({
    queryKey: ["customers", search, activeOnly],
    queryFn: () => fetchCustomers(search, activeOnly),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePatchCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CustomerCreate> & { active?: boolean } }) =>
      patchCustomer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente atualizado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente removido");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
