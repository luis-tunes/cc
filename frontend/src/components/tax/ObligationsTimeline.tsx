import { cn } from "@/lib/utils";
import { obligations } from "@/lib/tax-data";
import {
  CheckCircle2,
  CalendarClock,
  Clock,
  AlertTriangle,
  FileCheck,
  Shield,
  Landmark,
  Receipt,
  Users,
} from "lucide-react";

const typeIcon: Record<string, React.ReactNode> = {
  iva: <Receipt className="h-3.5 w-3.5" />,
  irc: <Landmark className="h-3.5 w-3.5" />,
  ies: <FileCheck className="h-3.5 w-3.5" />,
  ss: <Users className="h-3.5 w-3.5" />,
  outro: <Shield className="h-3.5 w-3.5" />,
};

const statusConfig = {
  "concluído": { label: "Concluído", icon: CheckCircle2, className: "text-tim-success bg-tim-success/10" },
  "pronto": { label: "Pronto", icon: CheckCircle2, className: "text-primary bg-primary/10" },
  "em-preparação": { label: "Em preparação", icon: Clock, className: "text-tim-info bg-tim-info/10" },
  "pendente": { label: "Pendente", icon: CalendarClock, className: "text-muted-foreground bg-muted" },
  "atrasado": { label: "Atrasado", icon: AlertTriangle, className: "text-tim-danger bg-tim-danger/10" },
};

export function ObligationsTimeline({ className }: { className?: string }) {
  const sorted = [...obligations].sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Obrigações Fiscais</h3>
        </div>
        <span className="text-xs text-muted-foreground">{obligations.filter((o) => o.status !== "concluído").length} ativas</span>
      </div>

      <div className="p-4">
        <div className="space-y-1">
          {sorted.map((ob) => {
            const cfg = statusConfig[ob.status];
            const StatusIcon = cfg.icon;
            const urgent = ob.daysLeft > 0 && ob.daysLeft <= 7;
            const near = ob.daysLeft > 7 && ob.daysLeft <= 15;

            return (
              <div
                key={ob.id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
                  urgent && "bg-tim-danger/5",
                  near && "bg-tim-warning/5"
                )}
              >
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", cfg.className)}>
                  {typeIcon[ob.type]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{ob.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ob.deadline}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                    cfg.className
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>

                  {ob.status !== "concluído" && (
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      ob.daysLeft <= 5 && "bg-tim-danger/15 text-tim-danger",
                      ob.daysLeft > 5 && ob.daysLeft <= 15 && "bg-tim-warning/15 text-tim-warning",
                      ob.daysLeft > 15 && "bg-muted text-muted-foreground"
                    )}>
                      {ob.daysLeft}d
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
