import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { AssetRegisterTable } from "@/components/assets/AssetRegisterTable";
import { AssetDetailDrawer } from "@/components/assets/AssetDetailDrawer";
import { AssetAlertsPanel } from "@/components/assets/AssetAlertsPanel";
import { mockAssets, assetSummary, type Asset } from "@/lib/assets-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus, Upload, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Assets() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fmt = (v: number) => `€${v.toLocaleString("pt-PT")}`;

  const handleSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setDrawerOpen(true);
  };

  return (
    <PageContainer
      title="Ativos e Depreciações"
      subtitle="Registo de ativos fixos, amortizações e tratamento contabilístico"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.info("Importação em desenvolvimento")}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar
          </Button>
          <Button size="sm" className="text-xs" onClick={() => toast.info("Adicionar ativo em desenvolvimento")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo Ativo
          </Button>
        </div>
      }
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total Ativos" value={String(assetSummary.totalAssets)} icon={Package} compact />
        <KpiCard label="Valor Aquisição" value={fmt(assetSummary.totalValue)} compact accent />
        <KpiCard label="Valor Líquido" value={fmt(assetSummary.totalNBV)} compact />
        <KpiCard label="Dep. Acumulada" value={fmt(assetSummary.totalDepreciation)} compact />
        <KpiCard label="Sem Regra" value={String(assetSummary.withoutRule)} icon={AlertTriangle} variant="warning" compact />
      </div>

      {/* Table + Alerts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AssetRegisterTable assets={mockAssets} onSelect={handleSelect} selectedId={selectedAsset?.id} />
        </div>
        <div>
          <AssetAlertsPanel />
        </div>
      </div>

      <AssetDetailDrawer asset={selectedAsset} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </PageContainer>
  );
}
