import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  useAdminTenants,
  useSystemHealth,
  useAdminMetrics,
  useRevenue,
  useEndpoints,
  useErrorLog,
  useChurnRisk,
} from "@/hooks/use-admin";
import { KpiCard } from "@/components/shared/KpiCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Users,
  FileText,
  Landmark,
  GitMerge,
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Clock,
  ShieldAlert,
  Signal,
  RefreshCw,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
}

function planBadge(plan: string, status: string) {
  if (plan === "pro" && status === "active")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Pro
      </Badge>
    );
  if (status === "past_due")
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        Pagamento pendente
      </Badge>
    );
  if (status === "trialing")
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        Trial
      </Badge>
    );
  if (status === "trial_expired")
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        Expirado
      </Badge>
    );
  if (status === "cancelled")
    return (
      <Badge className="bg-gray-100 text-gray-800 border-gray-200">
        Cancelado
      </Badge>
    );
  return <Badge variant="outline">Free</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function latencyColor(ms: number) {
  if (ms < 100) return "text-green-600";
  if (ms < 500) return "text-yellow-600";
  return "text-red-600";
}

function errorRateColor(rate: number) {
  if (rate === 0) return "text-green-600";
  if (rate < 0.05) return "text-yellow-600";
  return "text-red-600";
}

// ── VIEW 1: Revenue Command Center ──────────────────────────────────

function RevenueView() {
  const { data: revenue, isLoading: revLoading } = useRevenue();
  const { data: metrics, isLoading: metLoading } = useAdminMetrics();
  const { data: churnRisk, isLoading: churnLoading } = useChurnRisk();

  const isLoading = revLoading || metLoading || churnLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const conversionPct = revenue
    ? Math.round(revenue.trial_conversion_rate * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      {revenue && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            label="MRR"
            value={formatCurrency(revenue.mrr_eur)}
            icon={DollarSign}
            accent
          />
          <KpiCard
            label="ARR"
            value={formatCurrency(revenue.arr_eur)}
            icon={TrendingUp}
          />
          <KpiCard
            label="Pro ativos"
            value={String(revenue.pro_active)}
            icon={Users}
            accent
          />
          <KpiCard
            label="Em trial"
            value={String(revenue.trialing)}
            icon={Clock}
          />
          <KpiCard
            label="Conversão trial"
            value={`${conversionPct}%`}
            icon={TrendingUp}
            variant={conversionPct < 10 ? "warning" : "default"}
          />
          <KpiCard
            label="Cancelados"
            value={String(revenue.cancelled)}
            icon={TrendingDown}
            variant={revenue.cancelled > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Pagamento pendente"
            value={String(revenue.past_due)}
            icon={AlertTriangle}
            variant={revenue.past_due > 0 ? "danger" : "default"}
          />
          <KpiCard
            label="ARR em risco"
            value={formatCurrency(revenue.at_risk_arr_eur)}
            icon={ShieldAlert}
            variant={revenue.at_risk_arr_eur > 0 ? "danger" : "default"}
          />
          <KpiCard
            label="Total tenants"
            value={String(revenue.total_tenants)}
            icon={Users}
          />
          <KpiCard
            label="Trials expirados"
            value={String(revenue.trial_expired)}
            icon={AlertTriangle}
            variant={revenue.trial_expired > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* Platform metrics */}
      {metrics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Métricas da plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Documentos total</p>
                <p className="text-xl font-bold">{metrics.total_documents.toLocaleString("pt-PT")}</p>
                <p className="text-xs text-muted-foreground">Últimos 30d: {metrics.docs_last_30d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transações</p>
                <p className="text-xl font-bold">{metrics.total_transactions.toLocaleString("pt-PT")}</p>
                <p className="text-xs text-muted-foreground">Últimos 30d: {metrics.txs_last_30d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reconciliações</p>
                <p className="text-xl font-bold">{metrics.total_reconciliations.toLocaleString("pt-PT")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor processado</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.total_document_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Churn Risk Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Risco de churn ({churnRisk?.length || 0} tenants em risco)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="text-right">Docs</TableHead>
                  <TableHead>Razões de risco</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churnRisk?.map((t) => (
                  <TableRow key={t.tenant_id}>
                    <TableCell
                      className="font-mono text-xs max-w-[180px] truncate"
                      title={t.tenant_id}
                    >
                      {t.tenant_id}
                    </TableCell>
                    <TableCell>{planBadge(t.plan, t.status)}</TableCell>
                    <TableCell className="text-xs">
                      {timeAgo(t.last_activity)}
                    </TableCell>
                    <TableCell className="text-right">{t.doc_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.risk_reasons.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className="text-xs border-red-200 text-red-700"
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {t.risk_score}
                    </TableCell>
                  </TableRow>
                ))}
                {(!churnRisk || churnRisk.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500 inline mr-2" />
                      Sem tenants em risco
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── VIEW 2: Per-Tenant Drilldown ────────────────────────────────────

function TenantsView() {
  const {
    data: tenants,
    isLoading,
  } = useAdminTenants();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Todos os tenants ({tenants?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Transações</TableHead>
                <TableHead className="text-right">Reconciliações</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead>Trial até</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants?.map((t) => (
                <TableRow key={t.tenant_id}>
                  <TableCell
                    className="font-mono text-xs max-w-[180px] truncate"
                    title={t.tenant_id}
                  >
                    {t.tenant_id}
                  </TableCell>
                  <TableCell>{planBadge(t.plan, t.status)}</TableCell>
                  <TableCell className="text-right">{t.doc_count}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(t.doc_total)}
                  </TableCell>
                  <TableCell className="text-right">{t.tx_count}</TableCell>
                  <TableCell className="text-right">{t.recon_count}</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(t.last_activity)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(t.trial_end)}
                  </TableCell>
                </TableRow>
              ))}
              {(!tenants || tenants.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum tenant registado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── VIEW 3: Infra Monitoring ────────────────────────────────────────

function InfraView() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: endpoints, isLoading: epLoading } = useEndpoints(300);
  const { data: errors, isLoading: errLoading } = useErrorLog(50);

  const isLoading = healthLoading || epLoading || errLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const summary = endpoints?.summary;

  return (
    <div className="space-y-6">
      {/* Service Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Estado dos serviços
            {health && (
              <Badge
                variant={
                  health.status === "ok" ? "default" : "destructive"
                }
                className="ml-2"
              >
                {health.status === "ok" ? "Operacional" : "Degradado"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries(health.services).map(([name, svc]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <StatusIcon status={svc.status} />
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {svc.status === "ok" && svc.latency_ms != null
                        ? `${svc.latency_ms}ms`
                        : svc.detail || svc.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Performance Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Pedidos (5min)"
            value={String(summary.total_requests)}
            icon={Zap}
          />
          <KpiCard
            label="Erros (5min)"
            value={String(summary.total_errors)}
            icon={AlertTriangle}
            variant={summary.total_errors > 0 ? "danger" : "default"}
          />
          <KpiCard
            label="p50 latência"
            value={`${summary.p50_ms}ms`}
            icon={Signal}
          />
          <KpiCard
            label="p95 latência"
            value={`${summary.p95_ms}ms`}
            icon={Signal}
            variant={summary.p95_ms > 500 ? "warning" : "default"}
          />
          <KpiCard
            label="Taxa de erro"
            value={`${(summary.error_rate * 100).toFixed(1)}%`}
            icon={ShieldAlert}
            variant={summary.error_rate > 0.05 ? "danger" : "default"}
          />
          <KpiCard
            label="Tenants ativos"
            value={String(summary.active_tenants)}
            icon={Users}
          />
          <KpiCard
            label="Uptime"
            value={formatUptime(summary.uptime_seconds)}
            icon={RefreshCw}
          />
        </div>
      )}

      {/* Endpoint Performance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Performance por endpoint (últimos 5min)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="text-right">Tx erro</TableHead>
                  <TableHead className="text-right">p50</TableHead>
                  <TableHead className="text-right">p95</TableHead>
                  <TableHead className="text-right">p99</TableHead>
                  <TableHead className="text-right">Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints?.endpoints.map((ep) => (
                  <TableRow key={ep.endpoint}>
                    <TableCell className="font-mono text-xs">
                      {ep.endpoint}
                    </TableCell>
                    <TableCell className="text-right">
                      {ep.requests}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={ep.errors > 0 ? "text-red-600 font-medium" : ""}>
                        {ep.errors}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={errorRateColor(ep.error_rate)}>
                        {(ep.error_rate * 100).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={latencyColor(ep.p50_ms)}>
                        {ep.p50_ms}ms
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={latencyColor(ep.p95_ms)}>
                        {ep.p95_ms}ms
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={latencyColor(ep.p99_ms)}>
                        {ep.p99_ms}ms
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {ep.avg_ms}ms
                    </TableCell>
                  </TableRow>
                ))}
                {(!endpoints?.endpoints || endpoints.endpoints.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Sem dados de performance ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Error Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Erros recentes (5xx)
            {errors && errors.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {errors.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Request ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors?.map((err, i) => (
                  <TableRow key={`${err.request_id}-${i}`}>
                    <TableCell className="text-xs">
                      {timeAgo(err.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {err.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {err.path}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {err.status}
                    </TableCell>
                    <TableCell className="text-right">
                      {err.duration_ms.toFixed(0)}ms
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {err.tenant_id || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {err.request_id.slice(0, 8)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!errors || errors.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500 inline mr-2" />
                      Sem erros recentes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Admin Page ─────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState("revenue");
  const { isError, refetch } = useAdminTenants();

  if (isError) {
    return (
      <PageContainer title="Administração" subtitle="Acesso restrito">
        <ErrorState
          description="Sem permissão ou erro ao carregar dados de admin."
          onRetry={refetch}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Administração"
      subtitle="Monitorização do sistema, utilizadores e receita"
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Receita & Churn</span>
            <span className="sm:hidden">Receita</span>
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tenants</span>
            <span className="sm:hidden">Tenants</span>
          </TabsTrigger>
          <TabsTrigger value="infra" className="gap-1.5">
            <Server className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Infraestrutura</span>
            <span className="sm:hidden">Infra</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueView />
        </TabsContent>
        <TabsContent value="tenants">
          <TenantsView />
        </TabsContent>
        <TabsContent value="infra">
          <InfraView />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
