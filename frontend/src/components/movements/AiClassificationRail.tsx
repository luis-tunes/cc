import { cn } from "@/lib/utils";
import { Bot, AlertTriangle, Copy, RotateCcw, CheckCircle2 } from "lucide-react";
import type { classificationSummary as SummaryType } from "@/lib/movements-data";

interface AiClassificationRailProps {
  summary: typeof SummaryType;
  className?: string;
}

export function AiClassificationRail({ summary, className }: AiClassificationRailProps) {
  return (
    <div className={cn("rounded-lg border border-dashed border-primary/20 bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-primary/10 px-4 py-3">
        <Bot className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Classificação IA</h3>
      </div>

      <div className="space-y-1 p-3">
        <RailStat
          icon={CheckCircle2}
          label="Auto-classificados"
          value={summary.autoClassified}
          total={summary.total}
          variant="success"
        />
        <RailStat
          icon={Bot}
          label="Pendentes de revisão"
          value={summary.pendingReview}
          total={summary.total}
          variant="warning"
        />
        <RailStat
          icon={AlertTriangle}
          label="Anomalias"
          value={summary.anomalies}
          variant="danger"
        />
        <RailStat
          icon={Copy}
          label="Possíveis duplicados"
          value={summary.duplicates}
          variant="danger"
        />
        <RailStat
          icon={RotateCcw}
          label="Recorrentes"
          value={summary.recurring}
          variant="default"
        />
      </div>

      {/* Progress bar */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Progresso de classificação</span>
          <span className="font-semibold text-foreground">
            {Math.round((summary.autoClassified / summary.total) * 100)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(summary.autoClassified / summary.total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RailStat({
  icon: Icon,
  label,
  value,
  total,
  variant = "default",
}: {
  icon: any;
  label: string;
  value: number;
  total?: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    default: "text-muted-foreground",
    success: "text-tim-success",
    warning: "text-tim-warning",
    danger: "text-tim-danger",
  };

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors cursor-pointer">
      <Icon className={cn("h-3.5 w-3.5", colorMap[variant])} />
      <span className="flex-1 text-xs text-foreground">{label}</span>
      <span className={cn("text-xs font-semibold tabular-nums", colorMap[variant])}>
        {value}
        {total != null && (
          <span className="text-muted-foreground font-normal">/{total}</span>
        )}
      </span>
    </div>
  );
}
