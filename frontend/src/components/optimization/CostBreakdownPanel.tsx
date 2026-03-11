import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { costCategories } from "@/lib/cost-optimization-data";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";

function eur(v: number) {
  return `€${v.toLocaleString("pt-PT")}`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function CostBreakdownPanel() {
  const [expanded, setExpanded] = useState<string | null>("fse");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Decomposição de Custos por Classe SNC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {costCategories.map((cat) => {
          const isOpen = expanded === cat.id;
          const change = pctChange(cat.total, cat.previousTotal);
          return (
            <div key={cat.id}>
              <button
                onClick={() => setExpanded(isOpen ? null : cat.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {cat.sncClass}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {cat.sncLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      change > 5
                        ? "text-tim-danger"
                        : change > 0
                          ? "text-tim-warning"
                          : "text-tim-success"
                    )}
                  >
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>
                  <span className="w-16 text-right font-mono text-xs font-semibold text-foreground">
                    {eur(cat.total)}
                  </span>
                  <span className="w-10 text-right text-[10px] text-muted-foreground">
                    {cat.percentOfRevenue}%
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="mb-2 ml-9 space-y-0.5">
                  {cat.subcategories.map((sub) => {
                    const subChange = pctChange(sub.amount, sub.previous);
                    return (
                      <div
                        key={sub.label}
                        className="flex items-center gap-3 rounded px-3 py-1.5 text-xs hover:bg-secondary/30"
                      >
                        <span className="min-w-0 flex-1 text-muted-foreground">
                          {sub.label}
                        </span>
                        {sub.isRecurring && (
                          <RefreshCw className="h-3 w-3 shrink-0 text-tim-info/50" />
                        )}
                        <span
                          className={cn(
                            "text-[10px]",
                            subChange > 10
                              ? "text-tim-danger"
                              : subChange > 0
                                ? "text-muted-foreground"
                                : "text-tim-success"
                          )}
                        >
                          {subChange > 0 ? "+" : ""}
                          {subChange.toFixed(0)}%
                        </span>
                        <span className="w-14 text-right font-mono font-medium text-foreground">
                          {eur(sub.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
