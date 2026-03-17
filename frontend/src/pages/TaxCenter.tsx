import { PageContainer } from "@/components/layout/PageContainer";
import { useIvaPeriods, useIrcEstimate, useAuditFlags } from "@/hooks/use-tax";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/shared/KpiCard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertTriangle, AlertCircle, Info, TrendingUp, Receipt, CheckCircle2 } from "lucide-react";
import { useChartColors, tooltipStyle } from "@/hooks/use-chart-colors";

function fmt(n: number) {
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const SEVERITY_MAP = {
  error: { cls: "border-tim-danger/30 bg-tim-danger/5 text-tim-danger", icon: AlertCircle },
  warning: { cls: "border-tim-warning/30 bg-tim-warning/5 text-tim-warning", icon: AlertTriangle },
  info: { cls: "border-tim-info/30 bg-tim-info/5 text-tim-info", icon: Info },
} as const;

export default function TaxCenter() {
  const { data: ivaPeriods = [], isLoading: loadingIva } = useIvaPeriods();
  const { data: irc, isLoading: loadingIrc } = useIrcEstimate();
  const { data: auditData, isLoading: loadingAudit } = useAuditFlags();

  const colors = useChartColors();
  const currentIva = ivaPeriods[0];
  const ivaChartData = [...ivaPeriods].reverse().map((p) => ({
    period: p.period,
    cobrado: p.vat_collected,
    dedutivel: p.vat_deductible,
    devido: p.vat_due,
  }));

  return (
    <PageContainer
      title="Centro Fiscal"
      subtitle="IVA, IRC, obrigações fiscais e auditoria"
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="IVA a Pagar (último)"
          value={currentIva ? fmt(currentIva.vat_due) : "…"}
          icon={Receipt}
          accent
          compact
          variant={currentIva && currentIva.vat_due > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="IVA Cobrado"
          value={currentIva ? fmt(currentIva.vat_collected) : "…"}
          icon={TrendingUp}
          compact
        />
        <KpiCard
          label="IVA Dedutível"
          value={currentIva ? fmt(currentIva.vat_deductible) : "…"}
          icon={CheckCircle2}
          compact
        />
        <KpiCard
          label="IRC Estimado"
          value={irc ? fmt(irc.irc_estimate) : "…"}
          icon={Receipt}
          compact
          variant={irc && irc.irc_estimate > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6">
        <Tabs defaultValue="iva">
          <TabsList className="h-8 bg-secondary/50">
            <TabsTrigger value="iva" className="h-6 px-3 text-xs">IVA</TabsTrigger>
            <TabsTrigger value="irc" className="h-6 px-3 text-xs">IRC</TabsTrigger>
            <TabsTrigger value="auditoria" className="h-6 px-3 text-xs">
              Auditoria
              {auditData && auditData.total_issues > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-xs">
                  {auditData.total_issues}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* IVA tab */}
          <TabsContent value="iva" className="mt-4">
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">IVA por Trimestre</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Cobrado vs dedutível vs a pagar ao Estado</p>
              </div>
              <div className="p-4">
                {loadingIva ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">A carregar…</div>
                ) : ivaPeriods.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados fiscais — processe faturas para ver resultados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ivaChartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: colors.tick }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={44} />
                      <Tooltip formatter={(v) => fmt(v as number)} contentStyle={tooltipStyle(colors)} />
                      <Bar dataKey="cobrado" name="Cobrado" fill={colors.gold} radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar dataKey="dedutivel" name="Dedutível" fill={colors.success} radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar dataKey="devido" name="A Pagar" fill={colors.danger} radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Period table */}
              {ivaPeriods.length > 0 && (
                <div className="border-t">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {["Período","Docs","Faturado","IVA Cobrado","IVA Dedut.","A Pagar"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ivaPeriods.map((p) => (
                        <tr key={p.period} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2 font-medium">{p.period}</td>
                          <td className="px-4 py-2 text-muted-foreground">{p.doc_count}</td>
                          <td className="px-4 py-2">{fmt(p.total_invoiced)}</td>
                          <td className="px-4 py-2 text-tim-warning">{fmt(p.vat_collected)}</td>
                          <td className="px-4 py-2 text-tim-success">{fmt(p.vat_deductible)}</td>
                          <td className={cn("px-4 py-2 font-semibold", p.vat_due > 0 ? "text-tim-danger" : "text-tim-success")}>
                            {fmt(p.vat_due)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* IRC tab */}
          <TabsContent value="irc" className="mt-4">
            <div className="rounded-lg border bg-card p-6">
              {loadingIrc ? (
                <div className="text-sm text-muted-foreground">A calcular…</div>
              ) : irc ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                      { label: "Receitas", value: irc.receitas, color: "text-tim-success" },
                      { label: "Gastos", value: irc.gastos, color: "text-tim-danger" },
                      { label: "Resultado", value: irc.resultado, color: irc.resultado >= 0 ? "text-tim-success" : "text-tim-danger" },
                      { label: "IRC Estimado", value: irc.irc_estimate, color: "text-tim-warning" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-muted/40 px-4 py-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        <p className={cn("mt-1 text-xl font-semibold", item.color)}>{fmt(item.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-tim-info/20 bg-tim-info/5 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-tim-info" />
                      <div>
                        <p className="text-sm font-medium">Nota sobre a estimativa</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{irc.irc_rate_note}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Baseado em {irc.doc_count} documentos processados em {irc.year}. Consulte o seu contabilista para valores definitivos.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para estimar IRC.</p>
              )}
            </div>
          </TabsContent>

          {/* Auditoria tab */}
          <TabsContent value="auditoria" className="mt-4">
            {loadingAudit ? (
              <div className="text-sm text-muted-foreground">A analisar…</div>
            ) : auditData && auditData.flags.length > 0 ? (
              <div className="space-y-3">
                {auditData.flags.map((flag) => {
                  const { cls, icon: Icon } = SEVERITY_MAP[flag.severity];
                  return (
                    <div key={flag.type} className={cn("flex items-start gap-3 rounded-lg border p-4", cls)}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{flag.label}</p>
                          <Badge variant="outline" className="text-xs">{flag.count} ocorrências</Badge>
                        </div>
                        <p className="mt-0.5 text-xs opacity-80">{flag.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
                <CheckCircle2 className="h-10 w-10 text-tim-success" />
                <p className="mt-3 text-sm font-medium">Sem anomalias detectadas</p>
                <p className="mt-1 text-xs text-muted-foreground">A documentação está conforme os critérios de auditoria.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
