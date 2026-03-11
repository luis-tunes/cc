import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marginIndicators } from "@/lib/cost-optimization-data";
import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";

function formatValue(v: number, unit: string) {
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "days") return `${v}d`;
  return `€${v.toLocaleString("pt-PT")}`;
}

export function MarginIndicatorsPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-primary" />
          Indicadores de Margem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {marginIndicators.map((m) => {
          const isGood =
            m.direction === "higher-better"
              ? m.current >= m.benchmark
              : m.current <= m.benchmark;
          const isWorse =
            m.direction === "higher-better"
              ? m.current < m.previous
              : m.current > m.previous;

          const pctOfBenchmark =
            m.direction === "higher-better"
              ? Math.min((m.current / m.benchmark) * 100, 100)
              : Math.min((m.benchmark / m.current) * 100, 100);

          return (
            <div key={m.label}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold",
                      isGood ? "text-tim-success" : isWorse ? "text-tim-danger" : "text-tim-warning"
                    )}
                  >
                    {formatValue(m.current, m.unit)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    bench. {formatValue(m.benchmark, m.unit)}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isGood ? "bg-tim-success" : isWorse ? "bg-tim-danger" : "bg-tim-warning"
                    )}
                    style={{ width: `${pctOfBenchmark}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px]",
                    isWorse ? "text-tim-danger" : "text-muted-foreground"
                  )}
                >
                  ant. {formatValue(m.previous, m.unit)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
