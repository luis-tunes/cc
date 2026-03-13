export type AssetCategory = "equipamento" | "mobiliário" | "veículo" | "imóvel" | "informático" | "intangível";
export type DepreciationMethod = "linha-reta" | "quotas-decrescentes" | "não-definido";

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  acquisitionDate: string;
  acquisitionValue: number;
  method: DepreciationMethod;
  usefulLife: number;
  rate: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: "ativo" | "abatido" | "vendido";
  supplier?: string;
  invoiceRef?: string;
  notes?: string;
}

export interface DepreciationScheduleItem {
  year: number;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

export interface AssetSummary {
  totalAssets: number;
  totalAcquisitionValue: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
  annualDepreciation: number;
  withoutMethod: number;
}

export const categoryConfig: Record<AssetCategory, { label: string; icon: string }> = {
  equipamento: { label: "Equipamento", icon: "cog" },
  mobiliário: { label: "Mobiliário", icon: "armchair" },
  veículo: { label: "Veículo", icon: "car" },
  imóvel: { label: "Imóvel", icon: "building" },
  informático: { label: "Informático", icon: "monitor" },
  intangível: { label: "Intangível", icon: "file-code" },
};

export const methodConfig: Record<DepreciationMethod, { label: string }> = {
  "linha-reta": { label: "Linha Reta" },
  "quotas-decrescentes": { label: "Quotas Decrescentes" },
  "não-definido": { label: "Não Definido" },
};

/** Empty — will be populated from the API. */
export const assets: Asset[] = [];

export function getDepreciationSchedule(asset: Asset): DepreciationScheduleItem[] {
  if (asset.method === "não-definido" || asset.usefulLife <= 0) return [];
  const annualDep = asset.acquisitionValue * asset.rate;
  const items: DepreciationScheduleItem[] = [];
  let accumulated = 0;
  const startYear = new Date(asset.acquisitionDate).getFullYear();
  for (let i = 0; i < asset.usefulLife; i++) {
    accumulated = Math.min(accumulated + annualDep, asset.acquisitionValue);
    items.push({
      year: startYear + i,
      annualDepreciation: annualDep,
      accumulatedDepreciation: accumulated,
      netBookValue: asset.acquisitionValue - accumulated,
    });
  }
  return items;
}

export const assetSummary: AssetSummary = {
  totalAssets: 0,
  totalAcquisitionValue: 0,
  totalAccumulatedDepreciation: 0,
  totalNetBookValue: 0,
  annualDepreciation: 0,
  withoutMethod: 0,
};
