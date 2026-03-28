import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSystemHealth, useAdminMetrics, useRevenue, useEndpoints, useErrorLog } from "@/hooks/use-admin";
import { useBillingStatus } from "@/hooks/use-billing";
import { Loader2, Activity, Database, Server, RefreshCw, AlertTriangle, CheckCircle2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "bg-green-500" : status === "degraded" ? "bg-yellow-500" : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function ServiceCard({ name, service }: { name: string; service: { status: string; latency_ms?: number; detail?: string } }) {
  const icon = name === "postgresql" ? Database : name === "redis" ? Server : Activity;
  const Icon = icon;
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <StatusDot status={service.status} />
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium capitalize">{name}</span>
      </div>
      <div className="text-right">
        {service.latency_ms != null && (
          <span className="text-xs text-muted-foreground">{service.latency_ms}ms</span>
        )}
        {service.detail && (
          <span className="text-xs text-red-500">{service.detail}</span>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Monitoring() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const { data: health, isLoading: healthLoading, isError: healthError } = useSystemHealth();
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();
  const { data: revenue } = useRevenue();
  const { data: endpoints } = useEndpoints(300);
  const { data: errors } = useErrorLog(20);

  const loading = billingLoading || healthLoading || metricsLoading;

  // Only master users (is_master from billing status)
  if (!billingLoading && billing && !billing.is_master) {
    return (
      <PageContainer title="Monitorização">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-red-500/10 p-4 mb-4">
            <ShieldX className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta página é apenas para administradores.
          </p>
          <Button variant="outline" size="sm" className="mt-6" onClick={() => navigate("/painel")}>
            Voltar ao painel
          </Button>
        </div>
      </PageContainer>
    );
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  return (
    <PageContainer
      title="Monitorização"
      subtitle="Dashboard de infraestrutura e métricas"
      actions={
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={refresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Atualizar
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-primary" />
                Estado dos Serviços
                {health && (
                  <Badge variant={health.status === "ok" ? "default" : "destructive"} className="ml-2 text-xs">
                    {health.status === "ok" ? "Todos operacionais" : "Degradado"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {health?.services && Object.entries(health.services).map(([name, svc]) => (
                <ServiceCard key={name} name={name} service={svc} />
              ))}
            </CardContent>
          </Card>

          {/* KPI Grid */}
          {metrics && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <KpiCard label="Tenants" value={metrics.total_tenants} sub={`${metrics.pro_tenants} pro · ${metrics.trialing_tenants} trial`} />
              <KpiCard label="Documentos" value={metrics.total_documents} sub={`${metrics.docs_last_7d} últimos 7d`} />
              <KpiCard label="Transações" value={metrics.total_transactions} sub={`${metrics.txs_last_30d} últimos 30d`} />
              <KpiCard label="Reconciliações" value={metrics.total_reconciliations} />
            </div>
          )}

          {/* Revenue */}
          {revenue && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <KpiCard label="MRR" value={`${revenue.mrr_eur}€`} sub={`ARR: ${revenue.arr_eur}€`} />
              <KpiCard label="Conversão Trial" value={`${(revenue.trial_conversion_rate * 100).toFixed(1)}%`} />
              <KpiCard label="Cancelados" value={revenue.cancelled} sub={`${revenue.past_due} pagamentos falhados`} />
              <KpiCard label="ARR em Risco" value={`${revenue.at_risk_arr_eur}€`} />
            </div>
          )}

          {/* Endpoints Performance */}
          {endpoints && endpoints.endpoints.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-primary" />
                  Performance dos Endpoints
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    últimos {endpoints.window_seconds}s · {endpoints.summary.total_requests} pedidos
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4">Endpoint</th>
                        <th className="pb-2 pr-4 text-right">Pedidos</th>
                        <th className="pb-2 pr-4 text-right">Erros</th>
                        <th className="pb-2 pr-4 text-right">p50</th>
                        <th className="pb-2 pr-4 text-right">p95</th>
                        <th className="pb-2 text-right">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoints.endpoints.slice(0, 15).map((ep) => (
                        <tr key={ep.endpoint} className="border-b last:border-0">
                          <td className="py-1.5 pr-4 font-mono text-xs">{ep.endpoint}</td>
                          <td className="py-1.5 pr-4 text-right">{ep.requests}</td>
                          <td className="py-1.5 pr-4 text-right">
                            {ep.errors > 0 ? (
                              <span className="text-red-500">{ep.errors}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">{ep.p50_ms.toFixed(0)}ms</td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">{ep.p95_ms.toFixed(0)}ms</td>
                          <td className="py-1.5 text-right text-muted-foreground">{ep.avg_ms.toFixed(0)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Errors */}
          {errors && errors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Erros Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-red-500/10 bg-red-500/5 p-2.5 text-xs">
                      <Badge variant="destructive" className="text-xs">{err.status}</Badge>
                      <span className="font-mono">{err.method} {err.path}</span>
                      <span className="ml-auto text-muted-foreground">{err.duration_ms.toFixed(0)}ms</span>
                      <span className="text-muted-foreground">{new Date(err.timestamp).toLocaleTimeString("pt-PT")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No errors = good */}
          {errors && errors.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Sem erros recentes
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
