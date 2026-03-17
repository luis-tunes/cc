import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { usePlReport, useTopSuppliers } from "@/hooks/use-tax";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { downloadWithAuth } from "@/lib/api";
import { TrendingUp, TrendingDown, Download, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useChartColors, tooltipStyle } from "@/hooks/use-chart-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

function fmt(n: number) {
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const YEAR = new Date().getFullYear();



export default function Reports() {
  const colors = useChartColors();
  const [year, setYear] = useState(YEAR);
  const { data: pl, isLoading: loadingPl, isError, refetch } = usePlReport(year);
  const { data: topSuppliers = [], isLoading: loadingSuppliers } = useTopSuppliers(10);

  const barData = pl?.months ?? [];
  const totals = pl?.totals;

  const supplierPieData = topSuppliers.slice(0, 8).map((s) => ({
    name: s.supplier_nif,
    value: s.total_spend,
  }));

  if (isError) {
    return (
      <PageContainer title="Relatórios" subtitle="Demonstração de resultados, IVA e análise de fornecedores">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Relatórios"
      subtitle="Demonstração de resultados, IVA e análise de fornecedores"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-md bg-secondary/50 p-0.5">
            {[YEAR - 1, YEAR].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  year === y ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {y}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadWithAuth("/export/csv", "relatorio.csv")}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      }
    >
      {/* Annual KPI strip */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 mb-6">
          {[
            { label: "Receitas", value: totals.receitas, color: "text-tim-success" },
            { label: "Gastos", value: totals.gastos, color: "text-tim-danger" },
            { label: "Resultado", value: totals.resultado, color: totals.resultado >= 0 ? "text-tim-success" : "text-tim-danger" },
            { label: "IVA Cobrado", value: totals.iva_cobrado, color: "text-tim-warning" },
            { label: "IVA Dedutível", value: totals.iva_dedutivel, color: "text-tim-info" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card px-3 py-2.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={cn("mt-0.5 text-lg font-semibold", item.color)}>{fmt(item.value)}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="pl">
        <TabsList className="h-8 bg-secondary/50">
          <TabsTrigger value="pl" className="h-6 px-3 text-xs">Demonstração de Resultados</TabsTrigger>
          <TabsTrigger value="fornecedores" className="h-6 px-3 text-xs">Top Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="mt-4 space-y-4">
          {/* Chart */}
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Receitas vs Gastos {year}</h3>
            </div>
            <div className="p-4">
              {loadingPl ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">A carregar…</div>
              ) : barData.length === 0 ? (
                <EmptyState icon={BarChart3} title={`Sem documentos em ${year}`} description="Processe faturas para gerar o relatório." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: colors.tick }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={44} />
                    <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                    <Bar dataKey="receitas" name="Receitas" fill={colors.success} radius={[3,3,0,0]} maxBarSize={28} />
                    <Bar dataKey="gastos" name="Gastos" fill={colors.danger} radius={[3,3,0,0]} maxBarSize={28} />
                    <Bar dataKey="resultado" name="Resultado" fill={colors.gold} radius={[3,3,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Monthly table */}
          {barData.length > 0 && (
            <div className="rounded-lg border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Mês", "Receitas", "Gastos", "Resultado", "IVA Cobrado", "IVA Dedut.", "Docs"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {barData.map((m) => (
                    <tr key={m.month} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">{m.month_label}</td>
                      <td className="px-4 py-2 text-tim-success">{fmt(m.receitas)}</td>
                      <td className="px-4 py-2 text-tim-danger">{fmt(m.gastos)}</td>
                      <td className={cn("px-4 py-2 font-semibold", m.resultado >= 0 ? "text-tim-success" : "text-tim-danger")}>
                        <span className="flex items-center gap-1">
                          {m.resultado >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {fmt(m.resultado)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-tim-warning">{fmt(m.iva_cobrado)}</td>
                      <td className="px-4 py-2 text-tim-info">{fmt(m.iva_dedutivel)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.doc_count}</td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-tim-success">{fmt(totals.receitas)}</td>
                      <td className="px-4 py-2 text-tim-danger">{fmt(totals.gastos)}</td>
                      <td className={cn("px-4 py-2", totals.resultado >= 0 ? "text-tim-success" : "text-tim-danger")}>{fmt(totals.resultado)}</td>
                      <td className="px-4 py-2 text-tim-warning">{fmt(totals.iva_cobrado)}</td>
                      <td className="px-4 py-2 text-tim-info">{fmt(totals.iva_dedutivel)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{barData.reduce((s, m) => s + m.doc_count, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pie chart */}
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Distribuição por Fornecedor</h3>
              </div>
              <div className="p-4">
                {loadingSuppliers ? (
                  <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-44 w-full rounded-lg" /><Skeleton className="h-4 w-1/2" /></div>
                ) : supplierPieData.length === 0 ? (
                  <EmptyState icon={PieChartIcon} title="Sem dados" description="Processe faturas para ver a distribuição por fornecedor." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={supplierPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                        {supplierPieData.map((_, i) => <Cell key={i} fill={colors.pie[i % colors.pie.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            {/* Table */}
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Top 10 Fornecedores por Gasto</h3>
              </div>
              <div className="divide-y">
                {topSuppliers.map((s, i) => (
                  <div key={s.supplier_nif} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{s.supplier_nif}</p>
                      <p className="text-xs text-muted-foreground">{s.doc_count} docs · último {s.last_date ? new Date(s.last_date).toLocaleDateString("pt-PT") : "—"}</p>
                    </div>
                    <p className="text-xs font-semibold text-tim-danger">{fmt(s.total_spend)}</p>
                  </div>
                ))}
                {topSuppliers.length === 0 && !loadingSuppliers && (
                  <div className="py-8 text-center text-sm text-muted-foreground">Sem fornecedores registados</div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
