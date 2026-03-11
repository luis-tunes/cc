import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Loader2, CheckCircle2, AlertTriangle, Clock, HelpCircle } from "lucide-react";

interface CommandBarProps {
  summary: {
    total: number;
    approved: number;
    autoMatched: number;
    suggested: number;
    exceptions: number;
    unmatched: number;
  };
  activeFilter: string;
  onFilterChange: (f: string) => void;
  running: boolean;
  onRun: () => void;
  className?: string;
}

const filters = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "matched", label: "Reconciliados" },
  { key: "exceptions", label: "Exceções" },
  { key: "unmatched", label: "Sem par" },
];

export function ReconciliationCommandBar({
  summary,
  activeFilter,
  onFilterChange,
  running,
  onRun,
  className,
}: CommandBarProps) {
  const pctResolved = summary.total > 0
    ? Math.round(((summary.approved + summary.autoMatched) / summary.total) * 100)
    : 0;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Run button */}
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3 w-3" />
          )}
          {running ? "A reconciliar…" : "Executar Reconciliação"}
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Filter tabs */}
        <div className="flex rounded-md bg-muted p-0.5">
          {filters.map((f) => {
            const count =
              f.key === "all"
                ? summary.total
                : f.key === "pending"
                ? summary.suggested
                : f.key === "matched"
                ? summary.approved + summary.autoMatched
                : f.key === "exceptions"
                ? summary.exceptions
                : summary.unmatched;

            return (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeFilter === f.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums",
                    activeFilter === f.key ? "bg-muted text-foreground" : "bg-transparent"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary strip */}
        <div className="ml-auto flex items-center gap-4">
          <SummaryStat icon={CheckCircle2} value={summary.approved + summary.autoMatched} label="Reconciliados" variant="success" />
          <SummaryStat icon={Clock} value={summary.suggested} label="Pendentes" variant="warning" />
          <SummaryStat icon={AlertTriangle} value={summary.exceptions} label="Exceções" variant="danger" />
          <SummaryStat icon={HelpCircle} value={summary.unmatched} label="Sem par" variant="default" />

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pctResolved >= 80 ? "bg-tim-success" : pctResolved >= 50 ? "bg-tim-warning" : "bg-tim-danger"
                )}
                style={{ width: `${pctResolved}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-foreground">{pctResolved}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  value,
  label,
  variant,
}: {
  icon: any;
  value: number;
  label: string;
  variant: "success" | "warning" | "danger" | "default";
}) {
  const colors = {
    success: "text-tim-success",
    warning: "text-tim-warning",
    danger: "text-tim-danger",
    default: "text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("h-3 w-3", colors[variant])} />
      <span className={cn("text-xs font-semibold tabular-nums", colors[variant])}>{value}</span>
      <span className="hidden text-[10px] text-muted-foreground xl:inline">{label}</span>
    </div>
  );
}
