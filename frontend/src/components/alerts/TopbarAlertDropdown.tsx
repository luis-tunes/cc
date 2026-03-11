import { cn } from "@/lib/utils";
import { complianceAlerts, priorityConfig, getCriticalCount, type ComplianceAlert } from "@/lib/compliance-alerts-data";
import { Bell, Siren, AlertTriangle, Clock, Info, ArrowRight, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const priorityIcons = {
  critico: Siren,
  urgente: AlertTriangle,
  atencao: Clock,
  info: Info,
};

function MiniAlertRow({ alert }: { alert: ComplianceAlert }) {
  const navigate = useNavigate();
  const cfg = priorityConfig[alert.priority];
  const Icon = priorityIcons[alert.priority];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer",
        alert.priority === "critico" && "bg-tim-danger/5"
      )}
      onClick={() => alert.nextStepAction && navigate(alert.nextStepAction)}
    >
      <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded shrink-0", cfg.bg)}>
        <Icon className={cn("h-3 w-3", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-foreground truncate">{alert.title}</p>
          {alert.aiGenerated && <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />}
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{alert.nextStep}</p>
      </div>
      {alert.daysLeft !== undefined && (
        <span className={cn(
          "rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums shrink-0",
          alert.daysLeft <= 3 && "bg-tim-danger/15 text-tim-danger",
          alert.daysLeft > 3 && alert.daysLeft <= 7 && "bg-tim-warning/15 text-tim-warning",
          alert.daysLeft > 7 && "bg-muted text-muted-foreground"
        )}>
          {alert.daysLeft}d
        </span>
      )}
    </div>
  );
}

export function TopbarAlertDropdown() {
  const navigate = useNavigate();
  const critical = getCriticalCount(complianceAlerts);
  const sorted = [...complianceAlerts].sort((a, b) => {
    const order = { critico: 0, urgente: 1, atencao: 2, info: 3 };
    return order[a.priority] - order[b.priority];
  });
  const top = sorted.slice(0, 6);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground">
          <Bell className="h-4 w-4" />
          {critical > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-tim-danger text-[8px] font-bold text-tim-danger-foreground">
              {critical}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Siren className="h-3.5 w-3.5 text-tim-danger" />
            <span className="text-xs font-semibold text-foreground">Alertas de Conformidade</span>
          </div>
          {critical > 0 && (
            <span className="rounded bg-tim-danger/15 px-1.5 py-0.5 text-[9px] font-bold text-tim-danger">
              {critical} urgente{critical > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="p-1.5 space-y-0.5">
            {top.map((alert) => (
              <MiniAlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-[11px] text-primary hover:text-primary"
            onClick={() => navigate("/obrigacoes")}
          >
            Ver todos os alertas
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
