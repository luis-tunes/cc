import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAssets,
  fetchAssetsSummary,
  createAsset,
  patchAsset,
  deleteAsset,
  type Asset,
  type AssetCreate,
  type AssetSummary,
} from "@/lib/api";
import { toast } from "sonner";

export type { Asset, AssetSummary };

export function useAssets() {
  return useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: fetchAssets,
  });
}

export function useAssetsSummary() {
  return useQuery<AssetSummary>({
    queryKey: ["assets-summary"],
    queryFn: fetchAssetsSummary,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["assets-summary"] });
      toast.success("Ativo criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePatchAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<AssetCreate> }) =>
      patchAsset(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["assets-summary"] });
      toast.success("Ativo atualizado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["assets-summary"] });
      toast.success("Ativo removido");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
