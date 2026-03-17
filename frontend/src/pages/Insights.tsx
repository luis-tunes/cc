import { PageContainer } from "@/components/layout/PageContainer";
import { usePlReport, useTopSuppliers, useAuditFlags } from "@/hooks/use-tax";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useChartColors, tooltipStyle } from "@/hooks/use-chart-colors";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

function fmt(n: number) {
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}



export default function Insights() {
  const colors = useChartColors();
  const { data: pl, isError, refetch } = usePlReport();
  const { data: topSuppliers = [] } = useTopSuppliers(8);
  const { data: auditData } = useAuditFlags();

  const cashFlowData = pl?.months.map((m) => ({
    month: m.month_label,
    resultado: m.resultado,
    receitas: m.receitas,
    gastos: m.gastos,
  })) ?? [];

  const supplierData = topSuppliers.map((s) => ({ name: s.supplier_nif, value: s.total_spend }));

  const avgMontlyResult = cashFlowData.length > 0
    ? cashFlowData.reduce((s, m) => s + m.resultado, 0) / cashFlowData.length
    : 0;

  const profitableMonths = cashFlowData.filter((m) => m.resultado > 0).length;

  if (isError) {
    return (
      <PageContainer title="Insights" subtitle="Análises financeiras e deteção de anomalias">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Insights" subtitle="Análises financeiras e deteção de anomalias">
      {/* Summary insights */}
      {cashFlowData.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={cn("rounded-lg border p-4", avgMontlyResult >= 0 ? "border-tim-success/30 bg-tim-success/5" : "border-tim-danger/30 bg-tim-danger/5")}>
            <div className="flex items-center gap-2">
              {avgMontlyResult >= 0 ? <TrendingUp className="h-4 w-4 text-tim-success" /> : <TrendingDown className="h-4 w-4 text-tim-danger" />}
              <p className="text-xs font-medium text-muted-foreground">Resultado médio mensal</p>
            </div>
            <p className={cn("mt-1 text-xl font-semibold", avgMontlyResult >= 0 ? "text-tim-success" : "text-tim-danger")}>{fmt(avgMontlyResult)}</p>
          </div>
          <div className="rounded-lg border border-tim-info/30 bg-tim-info/5 p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-tim-info" />
              <p className="text-xs font-medium text-muted-foreground">Meses lucrativos</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-tim-info">{profitableMonths} / {cashFlowData.length}</p>
          </div>
          {auditData && auditData.total_issues > 0 && (
            <div className="rounded-lg border border-tim-warning/30 bg-tim-warning/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-tim-warning" />
                <p className="text-xs font-medium text-muted-foreground">Anomalias detectadas</p>
              </div>
              <p className="mt-1 text-xl font-semibold text-tim-warning">{auditData.total_issues}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cash flow trend */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Evolução do Resultado</h3>
          </div>
          <div className="p-4">
            {cashFlowData.length === 0 ? (
              <EmptyState icon={BarChart3} title="Sem dados suficientes" description="Processe faturas para ver a evolução do resultado." />
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="gradResult" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.gold} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={colors.gold} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.tick }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={44} />
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                  <Area type="monotone" dataKey="resultado" name="Resultado" stroke={colors.gold} strokeWidth={2} fill="url(#gradResult)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Supplier spend pie */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Gastos por Fornecedor</h3>
          </div>
          <div className="p-4">
            {supplierData.length === 0 ? (
              <EmptyState icon={PieChartIcon} title="Sem fornecedores com gastos registados" description="Os dados aparecerão após processar faturas." />
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <PieChart>
                  <Pie data={supplierData} cx="50%" cy="50%" outerRadius={72} innerRadius={36} dataKey="value" nameKey="name">
                    {supplierData.map((_, i) => <Cell key={i} fill={colors.pie[i % colors.pie.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* legend */}
          <div className="border-t divide-y">
            {supplierData.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 px-4 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.pie[i % colors.pie.length] }} />
                <span className="flex-1 truncate text-xs text-muted-foreground">{s.name}</span>
                <span className="text-xs font-medium">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
