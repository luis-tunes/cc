import { cn } from "@/lib/utils";
import { type Asset, generateSchedule, statusLabels, methodLabels } from "@/lib/assets-data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, X, Building2, Calendar, Tag, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AssetDetailDrawerProps {
  asset: Asset | null;
  open: boolean;
  onClose: () => void;
}

export function AssetDetailDrawer({ asset, open, onClose }: AssetDetailDrawerProps) {
  if (!asset) return null;

  const fmt = (v: number) => `€${v.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
  const stat = statusLabels[asset.status];
  const schedule = generateSchedule(asset);
  const depPct = asset.acquisitionValue > 0 ? Math.round((asset.accumulatedDepreciation / asset.acquisitionValue) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base font-semibold text-foreground">{asset.name}</SheetTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{asset.category} · {asset.sncAccount}</p>
            </div>
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-medium", stat.bg, stat.color)}>{stat.label}</span>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Lifecycle bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ciclo de Vida</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{depPct}% depreciado</span>
            </div>
            <Progress value={depPct} className="h-2 bg-muted" />
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>{fmt(asset.acquisitionValue)}</span>
              <span>VLíq: {fmt(asset.netBookValue)}</span>
            </div>
          </div>

          {/* Acquisition details */}
          <div className="rounded-md border px-3 py-2.5 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Aquisição</p>
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Calendar} label="Data" value={asset.acquisitionDate} />
              <DetailRow icon={Tag} label="Valor" value={fmt(asset.acquisitionValue)} />
              <DetailRow icon={BookOpen} label="Método" value={methodLabels[asset.method]} warn={asset.method === "não-definido"} />
              <DetailRow icon={BookOpen} label="Vida Útil" value={asset.usefulLife > 0 ? `${asset.usefulLife} anos (${asset.rate}%)` : "—"} warn={asset.usefulLife === 0} />
            </div>
            {asset.linkedSupplier && <DetailRow icon={Building2} label="Fornecedor" value={asset.linkedSupplier} />}
            {asset.linkedDocument && (
              <div className="flex items-center gap-2 pt-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-tim-info underline cursor-pointer">{asset.linkedDocument}</span>
              </div>
            )}
          </div>

          {/* AI suggestion */}
          {asset.aiSuggestion && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">Sugestão IA</span>
              </div>
              <p className="text-xs text-foreground">{asset.aiSuggestion}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 text-[10px]">Aplicar</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]">Editar</Button>
              </div>
            </div>
          )}

          {/* Depreciation schedule */}
          {schedule.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Mapa de Depreciação
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Ano</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">V. Inicial</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Depreciação</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">V. Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedule.map((row) => {
                      const currentYear = 2024;
                      const isPast = row.year < currentYear;
                      const isCurrent = row.year === currentYear;
                      return (
                        <tr key={row.year} className={cn(isPast && "opacity-50", isCurrent && "bg-primary/5")}>
                          <td className={cn("px-3 py-1.5 tabular-nums", isCurrent && "font-semibold text-primary")}>
                            {row.year}{isCurrent && " ←"}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(row.opening)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-tim-danger">{fmt(row.charge)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">{fmt(row.closing)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {asset.notes && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Notas</p>
              <p className="text-xs text-muted-foreground">{asset.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" className="flex-1 text-xs">Editar Ativo</Button>
            <Button variant="outline" size="sm" className="text-xs text-tim-danger hover:bg-tim-danger/10">Abater</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ icon: Icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className={cn("text-xs font-medium", warn ? "text-tim-warning italic" : "text-foreground")}>{value}</span>
    </div>
  );
}
