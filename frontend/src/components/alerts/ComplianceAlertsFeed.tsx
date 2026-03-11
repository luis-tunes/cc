import { cn } from "@/lib/utils";
import { complianceAlerts, priorityConfig, type ComplianceAlert } from "@/lib/compliance-alerts-data";
import { Siren, AlertTriangle, Clock, Info, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const priorityIcons = { critico: Siren, urgente: AlertTriangle, atencao: Clock, info: Info };

export function ComplianceAlertsFeed({ className, limit = 5 }: { className?: string; limit?: number }) {
  const navigate = useNavigate();
  const alerts = complianceAlerts
    .filter((a) => a.priority === "critico" || a.priority === "urgente")
    .slice(0, limit);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Siren className="h-4 w-4 text-tim-danger" />
          <h3 className="text-sm font-semibold text-foreground">Alertas Fiscais</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">{alerts.length} ações necessárias</span>
      </div>

      <div className="p-3 space-y-2">
        {alerts.map((alert) => {
          const cfg = priorityConfig[alert.priority];
          const Icon = priorityIcons[alert.priority];

          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
                cfg.border,
                alert.priority === "critico" && "bg-tim-danger/5"
              )}
            >
              <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded shrink-0", cfg.bg)}>
                <Icon className={cn("h-3 w-3", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-medium text-foreground">{alert.title}</p>
                  {alert.aiGenerated && <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.detail}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1.5 h-6 px-2 text-[10px] text-primary hover:text-primary"
                  onClick={() => alert.nextStepAction && navigate(alert.nextStepAction)}
                >
                  {alert.nextStep}
                  <ArrowRight className="ml-1 h-2.5 w-2.5" />
                </Button>
              </div>
              {alert.daysLeft !== undefined && (
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums shrink-0",
                  alert.daysLeft <= 3 && "bg-tim-danger/15 text-tim-danger",
                  alert.daysLeft > 3 && alert.daysLeft <= 7 && "bg-tim-warning/15 text-tim-warning",
                  alert.daysLeft > 7 && "bg-muted text-muted-foreground"
                )}>
                  {alert.daysLeft}d
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
