import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Package,
  Trash2,
  Download,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssets, useAssetsSummary, useCreateAsset, useDeleteAsset, type Asset } from "@/hooks/use-assets";
import { getExportAssetsCSVUrl, type AssetCreate } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmptyState } from "@/components/shared/EmptyState";

const CATEGORIES = [
  { value: "equipamento", label: "Equipamento" },
  { value: "mobiliário", label: "Mobiliário" },
  { value: "veículo", label: "Veículo" },
  { value: "imóvel", label: "Imóvel" },
  { value: "informático", label: "Informático" },
  { value: "intangível", label: "Intangível" },
];

const METHODS = [
  { value: "linha-reta", label: "Linha Reta" },
  { value: "quotas-decrescentes", label: "Quotas Decrescentes" },
  { value: "não-definido", label: "Não Definido" },
];

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-tim-success/15 text-tim-success border-tim-success/30",
  abatido: "bg-tim-danger/15 text-tim-danger border-tim-danger/30",
  vendido: "bg-muted text-muted-foreground border-border",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

function depreciationPct(asset: Asset): number {
  if (asset.acquisition_cost <= 0) return 0;
  return Math.round(((asset.acquisition_cost - asset.current_value) / asset.acquisition_cost) * 100);
}

function AddAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAsset();
  const [form, setForm] = useState<Partial<AssetCreate>>({
    category: "equipamento",
    depreciation_method: "linha-reta",
    useful_life_years: 5,
    status: "ativo",
    acquisition_date: new Date().toISOString().slice(0, 10),
  });

  const set = (k: keyof AssetCreate, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.acquisition_cost || !form.acquisition_date) return;
    create.mutate(form as AssetCreate, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Ativo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              placeholder="ex: Portátil MacBook Pro"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="abatido">Abatido</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor de Aquisição (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.acquisition_cost ?? ""}
                onChange={(e) => set("acquisition_cost", parseFloat(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Aquisição</Label>
              <Input
                type="date"
                value={form.acquisition_date ?? ""}
                onChange={(e) => set("acquisition_date", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Método de Depreciação</Label>
              <Select value={form.depreciation_method} onValueChange={(v) => set("depreciation_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vida Útil (anos)</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={form.useful_life_years ?? 5}
                onChange={(e) => set("useful_life_years", parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                placeholder="opcional"
                value={form.supplier ?? ""}
                onChange={(e) => set("supplier", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ref. Fatura</Label>
              <Input
                placeholder="opcional"
                value={form.invoice_ref ?? ""}
                onChange={(e) => set("invoice_ref", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Assets() {
  const { data: assets = [], isLoading } = useAssets();
  const { data: summary } = useAssetsSummary();
  const deleteAssetMutation = useDeleteAsset();
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);

  const activeAssets = assets.filter((a) => a.status === "ativo");

  return (
    <PageContainer
      title="Ativos Fixos"
      subtitle="Gestão de imobilizado e depreciações"
      actions={
        <div className="flex items-center gap-2">
          <a href={getExportAssetsCSVUrl()} download>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </a>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Novo Ativo
          </Button>
        </div>
      }
    >
      {/* Summary KPIs */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Ativos", value: String(summary.total_assets), sub: `${activeAssets.length} ativos` },
            { label: "Valor Aquisição", value: fmt(summary.total_acquisition_value), sub: "custo histórico" },
            { label: "Valor Líquido", value: fmt(summary.total_current_value), sub: "valor atual" },
            { label: "Dep. Anual", value: fmt(summary.annual_depreciation), sub: "este ano" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">A carregar ativos…</div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sem ativos registados"
          description="Registe os seus equipamentos, veículos e imóveis para calcular depreciações automáticas."
          actionLabel="Adicionar Ativo"
          onAction={() => setShowAdd(true)}
        />
      ) : isMobile ? (
        <div className="space-y-2">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.category} · {asset.acquisition_date}</p>
                </div>
                <Badge className={cn("shrink-0 border text-xs", STATUS_COLORS[asset.status])}>
                  {asset.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Valor líquido</span>
                <span className="font-semibold">{fmt(asset.current_value)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-tim-warning"
                    style={{ width: `${depreciationPct(asset)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{depreciationPct(asset)}% dep.</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data Aquisição</TableHead>
                <TableHead className="text-right">Valor Aquisição</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead>Depreciação</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const pct = depreciationPct(asset);
                return (
                  <TableRow key={asset.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{asset.category}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(asset.acquisition_date).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(asset.acquisition_cost)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(asset.current_value)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", pct > 75 ? "bg-tim-danger" : pct > 50 ? "bg-tim-warning" : "bg-tim-success")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border text-xs", STATUS_COLORS[asset.status])}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteAssetMutation.mutate(asset.id)}
                        className="p-1 text-muted-foreground hover:text-tim-danger transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddAssetDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </PageContainer>
  );
}

