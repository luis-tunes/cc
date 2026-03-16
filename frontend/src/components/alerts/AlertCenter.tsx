import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  complianceAlerts,
  priorityConfig,
  getAlertsByPriority,
  type ComplianceAlert,
  type AlertPriority,
} from "@/lib/compliance-alerts-data";
import {
  Siren,
  AlertTriangle,
  Clock,
  Info,
  ChevronRight,
  Lock,
  UserCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const priorityIcons: Record<AlertPriority, React.ElementType> = {
  critico: Siren,
  urgente: AlertTriangle,
  atencao: Clock,
  info: Info,
};

function AlertCard({ alert, onDismiss }: { alert: ComplianceAlert; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const cfg = priorityConfig[alert.priority];
  const Icon = priorityIcons[alert.priority];

  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-3 transition-all",
        cfg.border,
        alert.priority === "critico" && "bg-tim-danger/5",
        alert.priority === "urgente" && "bg-tim-warning/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-md shrink-0", cfg.bg)}>
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-foreground">{alert.title}</p>
            {alert.aiGenerated && (
              <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                IA
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{alert.detail}</p>

          {/* Blockers */}
          {alert.blockers && alert.blockers.length > 0 && (
            <div className="mt-2 space-y-1">
              {alert.blockers.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Lock className="h-2.5 w-2.5 text-tim-danger shrink-0" />
                  <span className="text-xs text-tim-danger">{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Waiting on */}
          {alert.waitingOn && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <UserCheck className="h-2.5 w-2.5 text-tim-info shrink-0" />
              <span className="text-xs text-tim-info">Aguarda: {alert.waitingOn}</span>
            </div>
          )}

          {/* Next step */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                if (alert.nextStepAction) navigate(alert.nextStepAction);
              }}
            >
              <ArrowRight className="h-3 w-3" />
              {alert.nextStep}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                onDismiss(alert.id);
                toast.success("Alerta arquivado");
              }}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Resolvido
            </Button>
          </div>
        </div>

        {/* Days left badge */}
        {alert.daysLeft !== undefined && (
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-bold tabular-nums shrink-0",
              alert.daysLeft <= 3 && "bg-tim-danger/15 text-tim-danger",
              alert.daysLeft > 3 && alert.daysLeft <= 7 && "bg-tim-warning/15 text-tim-warning",
              alert.daysLeft > 7 && alert.daysLeft <= 30 && "bg-tim-info/15 text-tim-info",
              alert.daysLeft > 30 && "bg-muted text-muted-foreground"
            )}
          >
            {alert.daysLeft}d
          </span>
        )}
      </div>
    </div>
  );
}

export function AlertCenter({ className }: { className?: string }) {
  const [alerts, setAlerts] = useState(complianceAlerts);
  const grouped = getAlertsByPriority(alerts);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const sections: { key: AlertPriority; label: string }[] = [
    { key: "critico", label: "Crítico" },
    { key: "urgente", label: "Urgente" },
    { key: "atencao", label: "Atenção" },
    { key: "info", label: "Informativo" },
  ];

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Siren className="h-4 w-4 text-tim-danger" />
          <h3 className="text-sm font-semibold text-foreground">Central de Alertas</h3>
        </div>
        <div className="flex items-center gap-2">
          {grouped.critico.length > 0 && (
            <span className="rounded-md bg-tim-danger/15 px-2 py-0.5 text-xs font-bold text-tim-danger">
              {grouped.critico.length} crítico{grouped.critico.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{alerts.length} alertas</span>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {sections.map(({ key, label }) => {
          const items = grouped[key];
          if (items.length === 0) return null;
          const cfg = priorityConfig[key];

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </span>
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", cfg.bg, cfg.color)}>
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
                ))}
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-tim-success/50" />
            <p className="mt-2 text-xs text-muted-foreground">Sem alertas pendentes</p>
          </div>
        )}
      </div>
    </div>
  );
}
