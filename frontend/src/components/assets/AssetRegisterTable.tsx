import { cn } from "@/lib/utils";
import { mockAssets, statusLabels, methodLabels, type Asset } from "@/lib/assets-data";
import { AlertTriangle, Sparkles, FileText } from "lucide-react";

interface AssetRegisterTableProps {
  assets: Asset[];
  onSelect: (asset: Asset) => void;
  selectedId?: string;
  className?: string;
}

export function AssetRegisterTable({ assets, onSelect, selectedId, className }: AssetRegisterTableProps) {
  const fmt = (v: number) => `€${v.toLocaleString("pt-PT", { minimumFractionDigits: 0 })}`;

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Ativo</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Categoria</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Aquisição</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Valor Aquisição</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Método</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Vida Útil</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Dep. Acum.</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Valor Líq.</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => {
              const stat = statusLabels[asset.status];
              return (
                <tr
                  key={asset.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/50",
                    selectedId === asset.id && "bg-accent/70",
                    asset.status === "sem-regra" && "bg-tim-warning/5",
                    asset.status === "totalmente-depreciado" && "opacity-60"
                  )}
                  onClick={() => onSelect(asset)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{asset.name}</span>
                      {asset.aiSuggestion && <Sparkles className="h-3 w-3 text-primary shrink-0" />}
                      {asset.linkedDocument && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{asset.category}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{asset.acquisitionDate}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">{fmt(asset.acquisitionValue)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn(asset.method === "não-definido" && "italic text-tim-warning")}>
                      {methodLabels[asset.method]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {asset.usefulLife > 0 ? `${asset.usefulLife}a` : <span className="text-tim-warning">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(asset.accumulatedDepreciation)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-foreground">{fmt(asset.netBookValue)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-medium", stat.bg, stat.color)}>
                      {stat.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
