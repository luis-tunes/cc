import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supplierConcentrations } from "@/lib/cost-optimization-data";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

const riskColors = {
  alto: "text-tim-danger",
  medio: "text-tim-warning",
  baixo: "text-tim-success",
};

const riskBg = {
  alto: "bg-tim-danger/10",
  medio: "bg-tim-warning/10",
  baixo: "bg-tim-success/10",
};

export function SupplierRiskPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-tim-warning" />
          Concentração de Fornecedores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {supplierConcentrations.map((s) => (
            <div
              key={s.supplier}
              className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{s.supplier}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {s.category} · {s.contracts > 0 ? `${s.contracts} contrato${s.contracts > 1 ? "s" : ""}` : "sem contrato"}
                </p>
              </div>

              {/* Concentration bar */}
              <div className="w-20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{s.percentOfCategory.toFixed(0)}%</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.riskLevel === "alto"
                        ? "bg-tim-danger"
                        : s.riskLevel === "medio"
                          ? "bg-tim-warning"
                          : "bg-tim-success"
                    )}
                    style={{ width: `${Math.min(s.percentOfCategory, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {s.trend === "up" && <TrendingUp className="h-3 w-3 text-tim-danger" />}
                {s.trend === "down" && <TrendingDown className="h-3 w-3 text-tim-success" />}
                {s.trend === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
              </div>

              <span className="w-16 text-right font-mono text-xs font-semibold text-foreground">
                €{s.totalSpend.toLocaleString("pt-PT")}
              </span>

              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  riskBg[s.riskLevel],
                  riskColors[s.riskLevel]
                )}
              >
                {s.riskLevel}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
