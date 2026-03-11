import { cn } from "@/lib/utils";
import { biInsights } from "@/lib/assistant-data";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

const severityStyle = {
  info: "border-border",
  warning: "border-tim-warning/30 bg-tim-warning/3",
  danger: "border-tim-danger/30 bg-tim-danger/3",
};

export function BiInsightsPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Inteligência Operacional</h3>
      </div>

      <div className="p-3 space-y-2">
        {biInsights.map((insight) => {
          const TrendIcon = insight.trend === "up" ? TrendingUp : insight.trend === "down" ? TrendingDown : Minus;
          const trendColor = insight.trend === "up" ? "text-tim-danger" : insight.trend === "down" ? "text-tim-warning" : "text-muted-foreground";

          return (
            <div key={insight.id} className={cn("rounded-md border px-3 py-2.5", severityStyle[insight.severity])}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{insight.title}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <TrendIcon className={cn("h-3 w-3", trendColor)} />
                  <span className={cn("text-xs font-semibold tabular-nums", trendColor)}>{insight.metric}</span>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{insight.detail}</p>
              <div className="mt-1.5 rounded bg-muted/50 px-2 py-1">
                <p className="text-[9px] text-muted-foreground">
                  <span className="font-medium text-primary/70">Análise: </span>
                  {insight.reasoning}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
