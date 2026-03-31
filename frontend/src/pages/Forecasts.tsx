import { PageContainer } from "@/components/layout/PageContainer";
import { usePlReport } from "@/hooks/use-tax";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Info, BarChart3 } from "lucide-react";
import { useChartColors, tooltipStyle } from "@/hooks/use-chart-colors";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmt(n: number) {
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Forecasts() {
  const { data: pl, isLoading, isError, refetch } = usePlReport();

  const colors = useChartColors();

  if (isLoading) {
    return (
      <PageContainer title="Previsões" subtitle="Projeções de cash flow baseadas em dados históricos">
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">A carregar dados…</p>
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer title="Previsões" subtitle="Projeções de cash flow baseadas em dados históricos">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  // Simple linear projection: average of last 3 months + trend
  const historical = pl?.months ?? [];
  const last3 = historical.slice(-3);
  const avgReceitas = last3.length > 0 ? last3.reduce((s, m) => s + m.receitas, 0) / last3.length : 0;
  const avgGastos = last3.length > 0 ? last3.reduce((s, m) => s + m.gastos, 0) / last3.length : 0;
  const trend = last3.length >= 2 ? (last3[last3.length - 1].resultado - last3[0].resultado) / last3.length : 0;

  const today = new Date();
  const projections = Array.from({ length: 6 }, (_, i) => {
    const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const m = futureDate.getMonth();
    const yr = futureDate.getFullYear().toString().slice(-2);
    const projReceitas = Math.max(0, avgReceitas + trend * i * 0.3);
    const projGastos = Math.max(0, avgGastos + trend * i * 0.1);
    return {
      month: `${MONTHS_PT[m]} ${yr}`,
      receitas: Math.round(projReceitas),
      gastos: Math.round(projGastos),
      resultado: Math.round(projReceitas - projGastos),
      isProjection: true,
    };
  });

  const chartData = [
    ...historical.map((m) => ({ month: m.month_label, receitas: m.receitas, gastos: m.gastos, resultado: m.resultado, isProjection: false })),
    ...projections,
  ];

  const totalProjectedReceitas = projections.reduce((s, m) => s + m.receitas, 0);
  const totalProjectedResultado = projections.reduce((s, m) => s + m.resultado, 0);

  return (
    <PageContainer title="Previsões" subtitle="Projeções de cash flow baseadas em dados históricos">
      {/* Summary — only show when there's historical data */}
      {historical.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-tim-info/30 bg-tim-info/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Receitas projetadas (6m)</p>
            <p className="mt-1 text-xl font-semibold text-tim-info">{fmt(totalProjectedReceitas)}</p>
          </div>
          <div className={cn("rounded-lg border p-4", totalProjectedResultado >= 0 ? "border-tim-success/30 bg-tim-success/5" : "border-tim-danger/30 bg-tim-danger/5")}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Resultado projetado (6m)</p>
            <div className="flex items-center gap-1.5">
              {totalProjectedResultado >= 0 ? <TrendingUp className="h-4 w-4 text-tim-success" /> : <TrendingDown className="h-4 w-4 text-tim-danger" />}
              <p className={cn("mt-1 text-xl font-semibold", totalProjectedResultado >= 0 ? "text-tim-success" : "text-tim-danger")}>{fmt(totalProjectedResultado)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-tim-warning/30 bg-tim-warning/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Média mensal (último trimestre)</p>
            <p className="mt-1 text-xl font-semibold text-tim-warning">{fmt(avgReceitas - avgGastos)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Histórico + Projeção 6 meses</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded" style={{ background: colors.success }} /> Receitas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded" style={{ background: colors.danger }} /> Gastos</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded border-2 border-dashed" style={{ borderColor: colors.gold, background: "transparent" }} /> Projeção</span>
          </div>
        </div>
        <div className="p-4">
          {chartData.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem dados históricos para projetar" description="Processe faturas para gerar previsões." />
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.success} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.tick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={44} />
                <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke={colors.success} strokeWidth={2} fill="url(#gradR)" />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke={colors.danger} strokeWidth={1.5} fill="none" />
                <Area type="monotone" dataKey="resultado" name="Resultado" stroke={colors.gold} strokeWidth={2} fill="none" strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Projeção baseada na média dos últimos {last3.length} meses com tendência linear simples. Não constitui previsão financeira certificada.</p>
      </div>
    </PageContainer>
  );
}
