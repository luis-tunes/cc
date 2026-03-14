import { PageContainer } from "@/components/layout/PageContainer";
import { usePlReport, useTopSuppliers } from "@/hooks/use-tax";
import { useAuditFlags } from "@/hooks/use-tax";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

function fmt(n: number) {
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const PIE_COLORS = ["hsl(40,80%,55%)","hsl(145,50%,42%)","hsl(210,60%,50%)","hsl(30,70%,50%)","hsl(0,65%,50%)","hsl(270,60%,55%)","hsl(180,50%,45%)","hsl(320,60%,55%)"];

export default function Insights() {
  const { data: pl } = usePlReport();
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
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados suficientes</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="gradResult" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(40,80%,55%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(40,80%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,12%,14%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={44} />
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,12%,16%)", borderRadius: 6, fontSize: 12 }} />
                  <Area type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(40,80%,55%)" strokeWidth={2} fill="url(#gradResult)" />
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
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem fornecedores com gastos registados</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <PieChart>
                  <Pie data={supplierData} cx="50%" cy="50%" outerRadius={72} innerRadius={36} dataKey="value" nameKey="name">
                    {supplierData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,12%,16%)", borderRadius: 6, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* legend */}
          <div className="border-t divide-y">
            {supplierData.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 px-4 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
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
