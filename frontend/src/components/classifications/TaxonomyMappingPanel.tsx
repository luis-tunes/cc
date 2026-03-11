import { cn } from "@/lib/utils";
import { taxonomyMappings } from "@/lib/classifications-data";
import { CheckCircle2, AlertTriangle, XCircle, Map } from "lucide-react";

const statusConfig = {
  mapeado: { label: "Mapeado", icon: CheckCircle2, className: "text-tim-success" },
  parcial: { label: "Parcial", icon: AlertTriangle, className: "text-tim-warning" },
  "em-falta": { label: "Em falta", icon: XCircle, className: "text-tim-danger" },
};

export function TaxonomyMappingPanel({ className }: { className?: string }) {
  const mapped = taxonomyMappings.filter((t) => t.status === "mapeado").length;
  const total = taxonomyMappings.length;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Mapeamento de Taxonomias</h3>
        </div>
        <span className="text-xs text-muted-foreground">{mapped}/{total} completos</span>
      </div>

      <div className="divide-y divide-border">
        {taxonomyMappings.map((t) => {
          const cfg = statusConfig[t.status];
          const StatusIcon = cfg.icon;

          return (
            <div
              key={t.code}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors",
                t.status === "em-falta" && "bg-tim-danger/5",
                t.status === "parcial" && "bg-tim-warning/5"
              )}
            >
              <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.className)} />

              <span className="font-mono text-[10px] font-medium text-muted-foreground w-14 shrink-0">{t.code}</span>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{t.label}</p>
                {t.warningText && (
                  <p className="text-[10px] text-tim-warning">{t.warningText}</p>
                )}
              </div>

              <span className="font-mono text-xs font-semibold text-primary shrink-0">{t.sncAccount}</span>

              <span className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium",
                t.status === "mapeado" && "bg-tim-success/10 text-tim-success",
                t.status === "parcial" && "bg-tim-warning/10 text-tim-warning",
                t.status === "em-falta" && "bg-tim-danger/10 text-tim-danger"
              )}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
