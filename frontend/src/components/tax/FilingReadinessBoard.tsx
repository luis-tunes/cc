import { cn } from "@/lib/utils";
import { filingReadiness } from "@/lib/tax-data";
import { CheckCircle2, AlertTriangle, XCircle, ClipboardCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const statusIcon = {
  ok: <CheckCircle2 className="h-4 w-4 text-tim-success" />,
  warning: <AlertTriangle className="h-4 w-4 text-tim-warning" />,
  danger: <XCircle className="h-4 w-4 text-tim-danger" />,
};

export function FilingReadinessBoard({ className }: { className?: string }) {
  const total = filingReadiness.length;
  const ready = filingReadiness.filter((f) => f.status === "ok").length;
  const pct = Math.round((ready / total) * 100);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Prontidão para Submissão</h3>
        </div>
        <span className={cn(
          "text-xs font-semibold",
          pct === 100 ? "text-tim-success" : pct >= 60 ? "text-tim-warning" : "text-tim-danger"
        )}>
          {pct}%
        </span>
      </div>

      <div className="p-4 space-y-4">
        <Progress
          value={pct}
          className="h-2 bg-muted"
        />

        <div className="space-y-1">
          {filingReadiness.map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
                item.status === "danger" && "bg-tim-danger/5",
                item.status === "warning" && "bg-tim-warning/5"
              )}
            >
              {statusIcon[item.status]}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              {item.count !== undefined && (
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                  item.status === "ok" && "bg-tim-success/10 text-tim-success",
                  item.status === "warning" && "bg-tim-warning/10 text-tim-warning",
                  item.status === "danger" && "bg-tim-danger/10 text-tim-danger"
                )}>
                  {item.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
