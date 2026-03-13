import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEntity, saveEntity } from "@/lib/api";

export function useEntity() {
  return useQuery({
    queryKey: ["entity"],
    queryFn: fetchEntity,
  });
}

export function useSaveEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, string>) => saveEntity(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entity"] });
    },
  });
}
