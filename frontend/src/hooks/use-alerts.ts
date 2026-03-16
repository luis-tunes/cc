import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAlerts, markAlertRead, generateAlerts, type Alert } from "@/lib/api";
import { toast } from "sonner";

export type { Alert };

export function useAlerts(unreadOnly = false) {
  return useQuery<Alert[]>({
    queryKey: ["alerts", { unreadOnly }],
    queryFn: () => fetchAlerts(unreadOnly),
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAlertRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useGenerateAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateAlerts,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(`${data.generated} alertas gerados`);
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}
