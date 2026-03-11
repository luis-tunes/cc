import { cn } from "@/lib/utils";
import { complianceAlerts, priorityConfig, getCriticalCount } from "@/lib/compliance-alerts-data";
import { Siren, AlertTriangle, ArrowRight, Lock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function DashboardComplianceStrip({ className }: { className?: string }) {
  const navigate = useNavigate();
  const critical = complianceAlerts.filter((a) => a.priority === "critico");
  const urgent = complianceAlerts.filter((a) => a.priority === "urgente");
  const top = [...critical, ...urgent].slice(0, 3);

  if (top.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-tim-danger/20 bg-tim-danger/5", className)}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Siren className="h-3.5 w-3.5 text-tim-danger" />
          <span className="text-[11px] font-semibold text-foreground">
            {getCriticalCount(complianceAlerts)} alertas requerem ação
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] text-primary hover:text-primary"
          onClick={() => navigate("/obrigacoes")}
        >
          Ver todos
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {top.map((alert) => {
          const cfg = priorityConfig[alert.priority];
          return (
            <div
              key={alert.id}
              className="flex items-center gap-3 rounded-md bg-card/80 px-3 py-2 cursor-pointer hover:bg-card transition-colors"
              onClick={() => alert.nextStepAction && navigate(alert.nextStepAction)}
            >
              {alert.priority === "critico" ? (
                <Siren className="h-3.5 w-3.5 text-tim-danger shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-tim-warning shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{alert.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {alert.blockers && alert.blockers.length > 0 && (
                    <span className="flex items-center gap-1 text-[9px] text-tim-danger">
                      <Lock className="h-2 w-2" />
                      {alert.blockers.length} bloqueio{alert.blockers.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {alert.waitingOn && (
                    <span className="flex items-center gap-1 text-[9px] text-tim-info">
                      <UserCheck className="h-2 w-2" />
                      {alert.waitingOn}
                    </span>
                  )}
                </div>
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
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
