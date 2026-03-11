import { cn } from "@/lib/utils";
import { assetAlerts } from "@/lib/assets-data";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

const sevConfig = {
  alta: { icon: AlertTriangle, color: "text-tim-danger", bg: "bg-tim-danger/10", border: "border-tim-danger/30" },
  média: { icon: ShieldAlert, color: "text-tim-warning", bg: "bg-tim-warning/10", border: "border-tim-warning/30" },
  baixa: { icon: Info, color: "text-tim-info", bg: "bg-tim-info/10", border: "border-tim-info/30" },
};

export function AssetAlertsPanel({ className }: { className?: string }) {
  const high = assetAlerts.filter((a) => a.severity === "alta").length;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-tim-warning" />
          <h3 className="text-sm font-semibold text-foreground">Alertas de Ativos</h3>
        </div>
        {high > 0 && (
          <span className="rounded-md bg-tim-danger/15 px-2 py-0.5 text-[10px] font-semibold text-tim-danger">
            {high} ação necessária
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {assetAlerts.map((alert) => {
          const cfg = sevConfig[alert.severity];
          const SevIcon = cfg.icon;
          return (
            <div key={alert.id} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", cfg.border, alert.severity === "alta" && "bg-tim-danger/5")}>
              <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded shrink-0", cfg.bg)}>
                <SevIcon className={cn("h-3.5 w-3.5", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{alert.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
