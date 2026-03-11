import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const monthlyData = [
  { mes: "Out", receita: 18200, gastos: 14100, resultado: 4100 },
  { mes: "Nov", receita: 21500, gastos: 15800, resultado: 5700 },
  { mes: "Dez", receita: 19800, gastos: 16200, resultado: 3600 },
  { mes: "Jan", receita: 22400, gastos: 15400, resultado: 7000 },
  { mes: "Fev", receita: 20100, gastos: 14900, resultado: 5200 },
  { mes: "Mar", receita: 24580, gastos: 16340, resultado: 8240 },
];

const weeklyData = [
  { mes: "Sem 1", receita: 5200, gastos: 3800, resultado: 1400 },
  { mes: "Sem 2", receita: 6100, gastos: 4200, resultado: 1900 },
  { mes: "Sem 3", receita: 5800, gastos: 4100, resultado: 1700 },
  { mes: "Sem 4", receita: 7480, gastos: 4240, resultado: 3240 },
];

type TimeWindow = "semana" | "mes" | "trimestre";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-xs text-muted-foreground">
          <span style={{ color: entry.color }}>●</span>{" "}
          {entry.name}: €{entry.value.toLocaleString("pt-PT")}
        </p>
      ))}
    </div>
  );
};

export function FinancialOverviewPanel({ className }: { className?: string }) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("mes");

  const data = timeWindow === "semana" ? weeklyData : monthlyData;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Desempenho Financeiro
        </h3>
        <div className="flex rounded-md bg-muted p-0.5">
          {(["semana", "mes", "trimestre"] as TimeWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => setTimeWindow(w)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                timeWindow === w
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {w === "semana" ? "Semana" : w === "mes" ? "Mês" : "Trimestre"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-2">
        {/* Revenue vs Expense */}
        <div className="border-b p-4 md:border-b-0 md:border-r">
          <p className="text-xs font-medium text-muted-foreground">
            Receita vs Gastos
          </p>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40, 80%, 55%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(40, 80%, 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220, 10%, 55%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(220, 10%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 12%, 14%)" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="hsl(40, 80%, 55%)"
                  strokeWidth={2}
                  fill="url(#gradReceita)"
                />
                <Area
                  type="monotone"
                  dataKey="gastos"
                  name="Gastos"
                  stroke="hsl(220, 10%, 55%)"
                  strokeWidth={1.5}
                  fill="url(#gradGastos)"
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Net Result */}
        <div className="p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Resultado Líquido
          </p>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 12%, 14%)" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="resultado"
                  name="Resultado"
                  fill="hsl(145, 50%, 42%)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cash position strip */}
      <div className="flex items-center gap-6 border-t px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Posição de Caixa
          </p>
          <p className="text-sm font-semibold text-foreground">€47.230</p>
        </div>
        <div className="h-6 w-px bg-border" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Margem Líquida
          </p>
          <p className="text-sm font-semibold text-tim-success">33,5%</p>
        </div>
        <div className="h-6 w-px bg-border" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            A Receber
          </p>
          <p className="text-sm font-semibold text-foreground">€12.800</p>
        </div>
        <div className="h-6 w-px bg-border" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            A Pagar
          </p>
          <p className="text-sm font-semibold text-foreground">€6.450</p>
        </div>
      </div>
    </div>
  );
}
