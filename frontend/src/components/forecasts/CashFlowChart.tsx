import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ForecastWeek } from "@/lib/forecast-data";
import { cn } from "@/lib/utils";

interface CashFlowChartProps {
  weeks: ForecastWeek[];
  scenarioModifier: number;
  className?: string;
}

function fmt(v: number) {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(0)}k`;
  return `€${v}`;
}

export function CashFlowChart({ weeks, scenarioModifier, className }: CashFlowChartProps) {
  const data = weeks.map((w) => {
    const adjOutflows = Math.round(w.outflows * scenarioModifier);
    const adjNet = w.inflows - adjOutflows - w.taxObligations;
    const adjBalance = w.runningBalance + (adjNet - w.netCash);
    return {
      week: w.weekLabel,
      inflows: w.inflows,
      outflows: adjOutflows,
      tax: w.taxObligations,
      balance: adjBalance,
      bandHigh: w.confidenceHigh + (adjNet - w.netCash),
      bandLow: w.confidenceLow + (adjNet - w.netCash),
      hasRisk: w.risks.length > 0,
    };
  });

  return (
    <div className={cn("h-[340px] w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220 12% 16%)"
            vertical={false}
          />
          <XAxis
            dataKey="week"
            tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
            axisLine={{ stroke: "hsl(220 12% 16%)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />

          {/* Confidence band */}
          <Area
            dataKey="bandHigh"
            stroke="none"
            fill="hsl(210 60% 50% / 0.08)"
            type="monotone"
            isAnimationActive={false}
          />
          <Area
            dataKey="bandLow"
            stroke="none"
            fill="hsl(var(--background))"
            type="monotone"
            isAnimationActive={false}
          />

          {/* Inflows / Outflows bars */}
          <Bar dataKey="inflows" fill="hsl(145 50% 42%)" radius={[2, 2, 0, 0]} barSize={14} name="Entradas" />
          <Bar dataKey="outflows" fill="hsl(0 65% 50% / 0.7)" radius={[2, 2, 0, 0]} barSize={14} name="Saídas" />
          <Bar dataKey="tax" fill="hsl(30 70% 50%)" radius={[2, 2, 0, 0]} barSize={14} name="Obrig. Fiscal" />

          {/* Running balance line */}
          <Area
            dataKey="balance"
            type="monotone"
            stroke="hsl(40 80% 55%)"
            strokeWidth={2}
            fill="hsl(40 80% 55% / 0.06)"
            dot={({ cx, cy, payload }: any) =>
              payload.hasRisk ? (
                <circle cx={cx} cy={cy} r={5} fill="hsl(0 65% 50%)" stroke="hsl(220 20% 6%)" strokeWidth={2} />
              ) : (
                <circle cx={cx} cy={cy} r={3} fill="hsl(40 80% 55%)" stroke="none" />
              )
            }
            name="Saldo"
          />

          {/* Safety threshold */}
          <ReferenceLine
            y={35000}
            stroke="hsl(0 65% 50% / 0.4)"
            strokeDasharray="6 4"
            label={{
              value: "Min. segurança €35k",
              position: "insideTopRight",
              fill: "hsl(0 65% 50% / 0.6)",
              fontSize: 10,
            }}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-xs shadow-xl">
                  <p className="mb-1.5 font-medium text-foreground">{label}</p>
                  {payload.map((p: any) => (
                    <div key={p.dataKey} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-mono font-medium text-foreground">
                        €{Number(p.value).toLocaleString("pt-PT")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
