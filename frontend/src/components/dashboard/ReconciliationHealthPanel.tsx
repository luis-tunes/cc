import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { AlertCircle, Clock, FileQuestion, AlertTriangle } from "lucide-react";

export function ReconciliationHealthPanel({ className }: { className?: string }) {
  const { data: summary, isLoading } = useDashboardSummary();

  const stats = useMemo(() => {
    if (!summary) return { total: 0, matched: 0, unmatched: 0, pendingDocs: 0, pendingClass: 0 };
    const matched = summary.reconciliations;
    const unmatched = summary.unmatched_documents;
    return {
      total: matched + unmatched,
      matched,
      unmatched,
      pendingDocs: summary.pending_review,
      pendingClass: summary.classified,
    };
  }, [summary]);

  const pct = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Saúde da Reconciliação
        </h3>
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isLoading ? "…" : `${stats.matched}/${stats.total} reconciliados`}
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
            value={stats.unmatched}
            variant="warning"
          />
          <StatItem
            icon={Clock}
            label="Docs. pendentes"
            value={stats.pendingDocs}
            variant="default"
          />
          <StatItem
            icon={FileQuestion}
            label="Classificados"
            value={stats.pendingClass}
            variant="warning"
          />
          <StatItem
            icon={AlertTriangle}
            label="Anomalias"
            value={0}
            variant="danger"
          />
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
