import { cn } from "@/lib/utils";
import { alertItems } from "@/lib/obligations-data";
import { AlertTriangle, Clock, Info, Siren } from "lucide-react";

const urgencyConfig = {
  critico: { icon: Siren, color: "text-tim-danger", bgColor: "bg-tim-danger/10", borderColor: "border-tim-danger/30" },
  urgente: { icon: AlertTriangle, color: "text-tim-warning", bgColor: "bg-tim-warning/10", borderColor: "border-tim-warning/30" },
  aviso: { icon: Clock, color: "text-tim-info", bgColor: "bg-tim-info/10", borderColor: "border-tim-info/30" },
  info: { icon: Info, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" },
};

export function AlertsPanel({ className }: { className?: string }) {
  const critical = alertItems.filter((a) => a.urgency === "critico").length;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-tim-warning" />
          <h3 className="text-sm font-semibold text-foreground">Alertas</h3>
        </div>
        {critical > 0 && (
          <span className="rounded-md bg-tim-danger/15 px-2 py-0.5 text-[10px] font-semibold text-tim-danger">
            {critical} crítico{critical > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {alertItems.map((alert) => {
          const cfg = urgencyConfig[alert.urgency];
          const UrgIcon = cfg.icon;

          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 rounded-md border px-3 py-2.5",
                cfg.borderColor,
                alert.urgency === "critico" && "bg-tim-danger/5"
              )}
            >
              <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded shrink-0", cfg.bgColor)}>
                <UrgIcon className={cn("h-3.5 w-3.5", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{alert.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.reason}</p>
              </div>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0",
                alert.daysLeft <= 3 && "bg-tim-danger/15 text-tim-danger",
                alert.daysLeft > 3 && alert.daysLeft <= 7 && "bg-tim-warning/15 text-tim-warning",
                alert.daysLeft > 7 && "bg-muted text-muted-foreground"
              )}>
                {alert.daysLeft}d
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
