import { cn } from "@/lib/utils";
import {
  priorityConfig,
  type AlertPriority,
} from "@/lib/compliance-alerts-data";
import {
  Siren,
  AlertTriangle,
  Clock,
  Info,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAlerts, useMarkAlertRead, useGenerateAlerts } from "@/hooks/use-alerts";
import type { Alert } from "@/lib/api";

const priorityIcons: Record<AlertPriority, React.ElementType> = {
  critico: Siren,
  urgente: AlertTriangle,
  atencao: Clock,
  info: Info,
};

function severityToPriority(severity: string): AlertPriority {
  if (severity === "critico") return "critico";
  if (severity === "urgente") return "urgente";
  if (severity === "atencao") return "atencao";
  return "info";
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: (id: number) => void }) {
  const navigate = useNavigate();
  const priority = severityToPriority(alert.severity);
  const cfg = priorityConfig[priority];
  const Icon = priorityIcons[priority];

  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-3 transition-all",
        cfg.border,
        priority === "critico" && "bg-tim-danger/5",
        priority === "urgente" && "bg-tim-warning/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-md shrink-0", cfg.bg)}>
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{alert.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{alert.description}</p>

          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {alert.action_url && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => navigate(alert.action_url!)}
              >
                <ArrowRight className="h-3 w-3" />
                Ver
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onDismiss(alert.id)}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Resolvido
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertCenter({ className }: { className?: string }) {
  const { data: alerts = [], isLoading } = useAlerts();
  const markRead = useMarkAlertRead();
  const genAlerts = useGenerateAlerts();

  const dismiss = (id: number) => {
    markRead.mutate(id);
  };

  const visible = alerts.filter((a) => !a.read);

  const grouped: Record<AlertPriority, Alert[]> = {
    critico: visible.filter((a) => a.severity === "critico"),
    urgente: visible.filter((a) => a.severity === "urgente"),
    atencao: visible.filter((a) => a.severity === "atencao"),
    info: visible.filter((a) => !["critico", "urgente", "atencao"].includes(a.severity)),
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => genAlerts.mutate()}
            disabled={genAlerts.isPending || isLoading}
            title="Verificar alertas"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", genAlerts.isPending && "animate-spin")} />
          </Button>
          <span className="text-xs text-muted-foreground">{visible.length} alertas</span>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />A carregar alertas…</div>
        )}
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

        {!isLoading && visible.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-tim-success/50" />
            <p className="mt-2 text-xs text-muted-foreground">Sem alertas pendentes</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs text-muted-foreground"
              onClick={() => genAlerts.mutate()}
              disabled={genAlerts.isPending}
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Verificar agora
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
