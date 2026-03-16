import { cn } from "@/lib/utils";
import { auditFlags } from "@/lib/tax-data";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";

const severityConfig = {
  alta: { icon: AlertTriangle, className: "text-tim-danger bg-tim-danger/10", badge: "bg-tim-danger/15 text-tim-danger" },
  média: { icon: ShieldAlert, className: "text-tim-warning bg-tim-warning/10", badge: "bg-tim-warning/15 text-tim-warning" },
  baixa: { icon: Info, className: "text-tim-info bg-tim-info/10", badge: "bg-tim-info/15 text-tim-info" },
};

const categoryLabels: Record<string, string> = {
  despesa: "Despesa",
  documento: "Documento",
  iva: "IVA",
  fornecedor: "Fornecedor",
  classificação: "Classificação",
};

export function AuditFlagsPanel({ className }: { className?: string }) {
  const high = auditFlags.filter((f) => f.severity === "alta").length;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-tim-danger" />
          <h3 className="text-sm font-semibold text-foreground">Alertas de Auditoria</h3>
        </div>
        {high > 0 && (
          <span className="rounded-md bg-tim-danger/15 px-2 py-0.5 text-xs font-semibold text-tim-danger">
            {high} alta prioridade
          </span>
        )}
      </div>

      <div className="p-4 space-y-1">
        {auditFlags.map((flag) => {
          const cfg = severityConfig[flag.severity];
          const SevIcon = cfg.icon;

          return (
            <div
              key={flag.id}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
                flag.severity === "alta" && "bg-tim-danger/5"
              )}
            >
              <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-md shrink-0", cfg.className)}>
                <SevIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{flag.title}</p>
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium uppercase", cfg.badge)}>
                    {flag.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{flag.detail}</p>
                <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {categoryLabels[flag.category]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
