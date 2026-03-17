import { PageContainer } from "@/components/layout/PageContainer";
import { usePlReport, useTopSuppliers } from "@/hooks/use-tax";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Lightbulb, AlertTriangle, Truck, BarChart3 } from "lucide-react";
import { useChartColors, tooltipStyle } from "@/hooks/use-chart-colors";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

function fmt(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default function CostOptimization() {
  const { data: pl, isError, refetch } = usePlReport();
  const { data: suppliers = [] } = useTopSuppliers(10);

  const colors = useChartColors();
  const months = pl?.months ?? [];
  const totals = pl?.totals;

  // Month-over-month cost trend
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const costTrend = lastMonth && prevMonth
    ? lastMonth.gastos - prevMonth.gastos
    : null;

  // Identify high-spend months (above average)
  const avgGastos = months.length > 0
    ? months.reduce((s, m) => s + m.gastos, 0) / months.length
    : 0;
  const highSpendMonths = months.filter((m) => m.gastos > avgGastos * 1.2).length;

  // Top supplier concentration
  const topSupplierSpend = suppliers.slice(0, 3).reduce((s, sup) => s + sup.total_spend, 0);
  const totalSupplierSpend = totals?.gastos ?? 0;
  const concentrationPct = pct(topSupplierSpend, totalSupplierSpend);

  // Suggestions
  const suggestions: { type: "warning" | "info" | "success"; message: string }[] = [];
  if (concentrationPct > 60) {
    suggestions.push({ type: "warning", message: `${concentrationPct}% dos gastos concentrados nos 3 principais fornecedores — considere diversificar.` });
  }
  if (highSpendMonths > 2) {
    suggestions.push({ type: "warning", message: `${highSpendMonths} meses com gastos acima da média — analise picos sazonais.` });
  }
  if (costTrend !== null && costTrend > avgGastos * 0.1) {
    suggestions.push({ type: "warning", message: `Gastos do último mês aumentaram ${fmt(costTrend)} face ao mês anterior.` });
  }
  if (costTrend !== null && costTrend < 0) {
    suggestions.push({ type: "success", message: `Gastos reduziram ${fmt(Math.abs(costTrend))} face ao mês anterior.` });
  }
  if (suggestions.length === 0 && months.length > 0) {
    suggestions.push({ type: "info", message: "Os seus gastos parecem estáveis. Continue a monitorizar regularmente." });
  }

  const chartData = months.map((m) => ({
    month: m.month_label,
    gastos: m.gastos,
    receitas: m.receitas,
  }));

  if (isError) {
    return (
      <PageContainer title="Otimização de Custos" subtitle="Análise de despesas e oportunidades de poupança">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Otimização de Custos"
      subtitle="Análise de despesas e oportunidades de poupança"
    >
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total gastos (ano)</p>
          <p className="mt-1 text-xl font-semibold text-tim-danger">{fmt(totals?.gastos ?? 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Média mensal</p>
          <p className="mt-1 text-xl font-semibold">{fmt(avgGastos)}</p>
        </div>
        <div className={cn("rounded-lg border p-4", costTrend === null ? "bg-card" : costTrend > 0 ? "border-tim-danger/30 bg-tim-danger/5" : "border-tim-success/30 bg-tim-success/5")}>
          <p className="text-xs text-muted-foreground">Variação último mês</p>
          <div className="mt-1 flex items-center gap-1">
            {costTrend !== null && (costTrend > 0
              ? <TrendingUp className="h-4 w-4 text-tim-danger" />
              : <TrendingDown className="h-4 w-4 text-tim-success" />
            )}
            <p className={cn("text-xl font-semibold", costTrend === null ? "text-foreground" : costTrend > 0 ? "text-tim-danger" : "text-tim-success")}>
              {costTrend === null ? "—" : `${costTrend > 0 ? "+" : ""}${fmt(costTrend)}`}
            </p>
          </div>
        </div>
        <div className={cn("rounded-lg border p-4", concentrationPct > 60 ? "border-tim-warning/30 bg-tim-warning/5" : "bg-card")}>
          <p className="text-xs text-muted-foreground">Concentração (top 3)</p>
          <p className={cn("mt-1 text-xl font-semibold", concentrationPct > 60 ? "text-tim-warning" : "text-foreground")}>
            {suppliers.length > 0 ? `${concentrationPct}%` : "—"}
          </p>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-6 space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              s.type === "warning" ? "border-tim-warning/30 bg-tim-warning/5" :
              s.type === "success" ? "border-tim-success/30 bg-tim-success/5" :
              "border-tim-info/30 bg-tim-info/5"
            )}>
              {s.type === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tim-warning" /> :
               s.type === "success" ? <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-tim-success" /> :
               <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-tim-info" />}
              <p className="text-sm">{s.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly cost chart */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Gastos vs. Receitas por mês</h3>
          </div>
          <div className="p-4">
            {chartData.length === 0 ? (
              <EmptyState icon={BarChart3} title="Sem dados suficientes" description="Processe faturas para ver a análise de custos." />
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.tick }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} width={44} />
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                  <Bar dataKey="receitas" name="Receitas" fill={colors.success} radius={[2, 2, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="gastos" name="Gastos" fill={colors.danger} radius={[2, 2, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top suppliers */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Principais fornecedores por gasto</h3>
          </div>
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} title="Sem fornecedores com gastos registados" description="Os fornecedores aparecerão aqui após processar faturas." />
          ) : (
            <div className="divide-y">
              {suppliers.map((s, i) => {
                const sharePct = pct(s.total_spend, totalSupplierSpend);
                return (
                  <div key={s.supplier_nif} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium font-mono">{s.supplier_nif}</p>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", i === 0 ? "bg-tim-danger" : i === 1 ? "bg-tim-warning" : "bg-primary/60")}
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{fmt(s.total_spend)}</p>
                      <p className="text-xs text-muted-foreground">{sharePct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

