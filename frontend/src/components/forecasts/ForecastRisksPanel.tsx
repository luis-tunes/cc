import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastRisk } from "@/lib/forecast-data";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastRisksPanelProps {
  risks: ForecastRisk[];
}

const severityConfig = {
  critico: { icon: ShieldAlert, color: "text-tim-danger", border: "border-tim-danger/30", bg: "bg-tim-danger/5" },
  atencao: { icon: AlertTriangle, color: "text-tim-warning", border: "border-tim-warning/20", bg: "bg-tim-warning/5" },
  info: { icon: Info, color: "text-tim-info", border: "border-tim-info/20", bg: "bg-tim-info/5" },
};

export function ForecastRisksPanel({ risks }: ForecastRisksPanelProps) {
  const sorted = [...risks].sort((a, b) => {
    const order = { critico: 0, atencao: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-tim-warning" />
          Riscos Identificados
          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {risks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Sem riscos identificados no horizonte.</p>
        )}
        {sorted.map((risk) => {
          const cfg = severityConfig[risk.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={risk.id}
              className={cn("flex items-start gap-3 rounded-md border p-3", cfg.border, cfg.bg)}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">{risk.label}</p>
                  {risk.amount && (
                    <span className={cn("shrink-0 font-mono text-xs font-semibold", cfg.color)}>
                      €{risk.amount.toLocaleString("pt-PT")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {risk.description}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
