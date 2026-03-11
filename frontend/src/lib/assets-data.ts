export type AssetStatus = "ativo" | "totalmente-depreciado" | "abatido" | "sem-regra";
export type DepreciationMethod = "linha-reta" | "quotas-decrescentes" | "não-definido";

export interface Asset {
  id: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionValue: number;
  method: DepreciationMethod;
  usefulLife: number; // years, 0 if undefined
  rate: number; // annual %
  accumulatedDepreciation: number;
  netBookValue: number;
  linkedSupplier?: string;
  linkedDocument?: string;
  sncAccount: string;
  status: AssetStatus;
  notes?: string;
  aiSuggestion?: string;
}

export interface DepreciationScheduleRow {
  year: number;
  opening: number;
  charge: number;
  closing: number;
}

export interface AssetAlert {
  id: string;
  assetId: string;
  severity: "alta" | "média" | "baixa";
  title: string;
  detail: string;
}

export const methodLabels: Record<DepreciationMethod, string> = {
  "linha-reta": "Linha Reta",
  "quotas-decrescentes": "Quotas Decrescentes",
  "não-definido": "Não Definido",
};

export const statusLabels: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  ativo: { label: "Ativo", color: "text-tim-success", bg: "bg-tim-success/10" },
  "totalmente-depreciado": { label: "Tot. Depreciado", color: "text-muted-foreground", bg: "bg-muted" },
  abatido: { label: "Abatido", color: "text-tim-danger", bg: "bg-tim-danger/10" },
  "sem-regra": { label: "Sem Regra", color: "text-tim-warning", bg: "bg-tim-warning/10" },
};

export const mockAssets: Asset[] = [
  { id: "a-1", name: "MacBook Pro 16\" M3", category: "Eq. Informático", acquisitionDate: "2024-01-15", acquisitionValue: 3200, method: "linha-reta", usefulLife: 4, rate: 25, accumulatedDepreciation: 200, netBookValue: 3000, linkedSupplier: "Apple Store", linkedDocument: "fatura_apple_jan24.pdf", sncAccount: "43.1.3", status: "ativo" },
  { id: "a-2", name: "Mobiliário Escritório (Secretárias)", category: "Eq. Administrativo", acquisitionDate: "2023-06-01", acquisitionValue: 4800, method: "linha-reta", usefulLife: 8, rate: 12.5, accumulatedDepreciation: 1050, netBookValue: 3750, linkedSupplier: "IKEA Business", linkedDocument: "fatura_ikea_jun23.pdf", sncAccount: "43.1.5", status: "ativo" },
  { id: "a-3", name: "Software ERP (Licença)", category: "At. Intangível", acquisitionDate: "2023-03-01", acquisitionValue: 2800, method: "linha-reta", usefulLife: 3, rate: 33.33, accumulatedDepreciation: 933, netBookValue: 1867, sncAccount: "44.1", status: "ativo", linkedDocument: "fatura_erp_license.pdf" },
  { id: "a-4", name: "Viatura Ligeira (Seat Leon)", category: "Eq. Transporte", acquisitionDate: "2022-09-01", acquisitionValue: 28000, method: "quotas-decrescentes", usefulLife: 5, rate: 20, accumulatedDepreciation: 14560, netBookValue: 13440, linkedSupplier: "Concessionário SEAT", linkedDocument: "contrato_leasing_seat.pdf", sncAccount: "43.1.4", status: "ativo" },
  { id: "a-5", name: "Impressora Multifunções", category: "Eq. Informático", acquisitionDate: "2020-04-15", acquisitionValue: 890, method: "linha-reta", usefulLife: 4, rate: 25, accumulatedDepreciation: 890, netBookValue: 0, sncAccount: "43.1.3", status: "totalmente-depreciado" },
  { id: "a-6", name: "Ar Condicionado (2 unidades)", category: "Eq. Administrativo", acquisitionDate: "2024-02-20", acquisitionValue: 3600, method: "não-definido", usefulLife: 0, rate: 0, accumulatedDepreciation: 0, netBookValue: 3600, linkedSupplier: "Clima Total, Lda.", linkedDocument: "fatura_clima_fev24.pdf", sncAccount: "43.1.5", status: "sem-regra", aiSuggestion: "Categoria sugerida: Equipamento Administrativo. Vida útil: 8 anos (12,5%). Método: Linha Reta." },
  { id: "a-7", name: "Monitor Dell 27\" (x3)", category: "Eq. Informático", acquisitionDate: "2024-01-15", acquisitionValue: 1800, method: "não-definido", usefulLife: 0, rate: 0, accumulatedDepreciation: 0, netBookValue: 1800, sncAccount: "43.1.3", status: "sem-regra", aiSuggestion: "Vida útil sugerida: 4 anos (25%). Pode agrupar com MacBook Pro como conjunto informático." },
];

export function generateSchedule(asset: Asset): DepreciationScheduleRow[] {
  if (asset.method === "não-definido" || asset.usefulLife === 0) return [];
  const rows: DepreciationScheduleRow[] = [];
  const startYear = new Date(asset.acquisitionDate).getFullYear();
  let remaining = asset.acquisitionValue;
  for (let i = 0; i < asset.usefulLife; i++) {
    const charge = asset.method === "linha-reta"
      ? Math.round((asset.acquisitionValue / asset.usefulLife) * 100) / 100
      : Math.round(remaining * (asset.rate / 100) * 2) / 100; // simplified
    const actualCharge = Math.min(charge, remaining);
    const closing = Math.max(0, Math.round((remaining - actualCharge) * 100) / 100);
    rows.push({ year: startYear + i, opening: Math.round(remaining * 100) / 100, charge: actualCharge, closing });
    remaining = closing;
    if (remaining <= 0) break;
  }
  return rows;
}

export const assetAlerts: AssetAlert[] = [
  { id: "aa-1", assetId: "a-6", severity: "alta", title: "Ar Condicionado sem regra de depreciação", detail: "Ativo adquirido há 16 dias sem método ou vida útil definidos." },
  { id: "aa-2", assetId: "a-7", severity: "alta", title: "Monitores Dell sem regra de depreciação", detail: "3 monitores sem tratamento contabilístico definido." },
  { id: "aa-3", assetId: "a-5", severity: "baixa", title: "Impressora totalmente depreciada", detail: "Valor contabilístico €0. Considerar abate se já não estiver em uso." },
  { id: "aa-4", assetId: "", severity: "média", title: "Compra de €3.600 não classificada como ativo", detail: "Transação recente de valor elevado em FSE — verificar se deveria ser capitalizada." },
];

export const assetSummary = {
  totalAssets: mockAssets.length,
  totalValue: mockAssets.reduce((s, a) => s + a.acquisitionValue, 0),
  totalNBV: mockAssets.reduce((s, a) => s + a.netBookValue, 0),
  totalDepreciation: mockAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0),
  withoutRule: mockAssets.filter((a) => a.status === "sem-regra").length,
  fullyDepreciated: mockAssets.filter((a) => a.status === "totalmente-depreciado").length,
};
