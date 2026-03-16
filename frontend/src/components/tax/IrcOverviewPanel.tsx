import { cn } from "@/lib/utils";
import { ircEstimate } from "@/lib/tax-data";
import { Landmark, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";

export function IrcOverviewPanel({ className }: { className?: string }) {
  const fmt = (v: number) => `€${Math.abs(v).toLocaleString("pt-PT")}`;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">IRC</h3>
        </div>
        <span className="text-xs text-muted-foreground">Estimativa 2024</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Proveitos</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{fmt(ircEstimate.revenue)}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Custos</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{fmt(ircEstimate.costs)}</p>
          </div>
        </div>

        {/* Taxable base */}
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Matéria Coletável Estimada</p>
            <span className="text-xs text-muted-foreground">{(ircEstimate.rate * 100).toFixed(0)}%</span>
          </div>
          <p className="mt-0.5 text-lg font-semibold text-primary">{fmt(ircEstimate.taxableBase)}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">IRC estimado</span>
            <span className="text-sm font-semibold text-foreground">{fmt(ircEstimate.estimatedIrc)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tributação autónoma</span>
            <span className="text-xs font-medium text-tim-warning">{fmt(ircEstimate.autonomousTax)}</span>
          </div>
        </div>

        {/* Adjustments */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Correções Fiscais
          </p>
          <div className="space-y-1">
            {ircEstimate.adjustments.map((adj, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-accent/50 transition-colors">
                {adj.type === "add" ? (
                  <ArrowUp className="h-3 w-3 text-tim-danger shrink-0" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-tim-success shrink-0" />
                )}
                <span className="flex-1 text-xs text-foreground">{adj.label}</span>
                <span className={cn(
                  "text-xs font-mono font-medium",
                  adj.type === "add" ? "text-tim-danger" : "text-tim-success"
                )}>
                  {adj.type === "add" ? "+" : "−"}{fmt(adj.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-tim-warning/5 border border-tim-warning/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-tim-warning mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Valores estimados com base nos dados atuais. O apuramento final pode variar.
          </p>
        </div>
      </div>
    </div>
  );
}
