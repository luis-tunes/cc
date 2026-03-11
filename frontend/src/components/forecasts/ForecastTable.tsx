import { ForecastWeek } from "@/lib/forecast-data";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface ForecastTableProps {
  weeks: ForecastWeek[];
  scenarioModifier: number;
}

function eur(v: number) {
  return `€${v.toLocaleString("pt-PT")}`;
}

export function ForecastTable({ weeks, scenarioModifier }: ForecastTableProps) {
  let runBal = 42_350;
  const rows = weeks.map((w) => {
    const adjOut = Math.round(w.outflows * scenarioModifier);
    const adjNet = w.inflows - adjOut - w.taxObligations;
    runBal += adjNet;
    return { ...w, adjOut, adjNet, adjBalance: runBal };
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Semana</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Entradas</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saídas</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fiscal</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Líquido</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saldo</th>
            <th className="w-8 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.weekLabel}
              className={cn(
                "border-b border-border/50 transition-colors hover:bg-secondary/30",
                r.adjBalance < 35_000 && "bg-tim-danger/5"
              )}
            >
              <td className="px-3 py-2.5 font-medium text-foreground">{r.weekLabel}</td>
              <td className="px-3 py-2.5 text-right font-mono text-tim-success">{eur(r.inflows)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-tim-danger">{eur(r.adjOut)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-tim-warning">
                {r.taxObligations > 0 ? eur(r.taxObligations) : "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right font-mono font-semibold",
                  r.adjNet >= 0 ? "text-tim-success" : "text-tim-danger"
                )}
              >
                {r.adjNet >= 0 ? "+" : ""}
                {eur(r.adjNet)}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right font-mono font-semibold",
                  r.adjBalance < 35_000 ? "text-tim-danger" : "text-foreground"
                )}
              >
                {eur(r.adjBalance)}
              </td>
              <td className="px-3 py-2.5 text-center">
                {r.risks.length > 0 && (
                  <AlertTriangle
                    className={cn(
                      "inline h-3.5 w-3.5",
                      r.risks.some((rk) => rk.severity === "critico")
                        ? "text-tim-danger"
                        : "text-tim-warning"
                    )}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
