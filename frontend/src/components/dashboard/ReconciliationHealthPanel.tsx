import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Clock, FileQuestion, AlertTriangle } from "lucide-react";

const reconciliationData = {
  total: 142,
  matched: 118,
  unmatched: 24,
  pendingDocuments: 7,
  pendingClassification: 13,
  anomalies: 3,
};

const pct = Math.round((reconciliationData.matched / reconciliationData.total) * 100);

const recentAnomalies = [
  { description: "Depósito não identificado — €1.000", date: "05 Mar" },
  { description: "Duplicação possível — Fatura #812", date: "04 Mar" },
  { description: "Valor divergente — Fornecedor XYZ", date: "03 Mar" },
];

export function ReconciliationHealthPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Saúde da Reconciliação
        </h3>
        <span className="text-xs text-muted-foreground">Março 2024</span>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {reconciliationData.matched}/{reconciliationData.total} reconciliados
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              pct >= 80 ? "text-tim-success" : pct >= 50 ? "text-tim-warning" : "text-tim-danger"
            )}
          >
            {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 80 ? "bg-tim-success" : pct >= 50 ? "bg-tim-warning" : "bg-tim-danger"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatItem
            icon={AlertCircle}
            label="Não reconciliados"
            value={reconciliationData.unmatched}
            variant="warning"
          />
          <StatItem
            icon={Clock}
            label="Docs. pendentes"
            value={reconciliationData.pendingDocuments}
            variant="default"
          />
          <StatItem
            icon={FileQuestion}
            label="Por classificar"
            value={reconciliationData.pendingClassification}
            variant="warning"
          />
          <StatItem
            icon={AlertTriangle}
            label="Anomalias"
            value={reconciliationData.anomalies}
            variant="danger"
          />
        </div>

        {/* Recent anomalies */}
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Anomalias Recentes
          </p>
          <div className="mt-2 space-y-1.5">
            {recentAnomalies.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md bg-tim-danger/5 px-2.5 py-1.5"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-tim-danger" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-foreground">{a.description}</p>
                  <p className="text-[10px] text-muted-foreground">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: any;
  label: string;
  value: number;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2">
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          variant === "danger" && "text-tim-danger",
          variant === "warning" && "text-tim-warning",
          variant === "default" && "text-muted-foreground"
        )}
      />
      <div>
        <p
          className={cn(
            "text-sm font-semibold",
            variant === "danger" && "text-tim-danger",
            variant === "warning" && "text-tim-warning",
            variant === "default" && "text-foreground"
          )}
        >
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
