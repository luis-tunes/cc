import { PageContainer } from "@/components/layout/PageContainer";
import { useAdminTenants, useSystemHealth, useAdminMetrics } from "@/hooks/use-admin";
import { KpiCard } from "@/components/shared/KpiCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, FileText, Landmark, GitMerge, Activity, Server, Database, HardDrive, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
}

function planBadge(plan: string, status: string) {
  if (plan === "pro" && status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Pro</Badge>;
  if (status === "trialing") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Trial</Badge>;
  if (status === "trial_expired") return <Badge className="bg-red-100 text-red-800 border-red-200">Expirado</Badge>;
  if (status === "cancelled") return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Cancelado</Badge>;
  return <Badge variant="outline">Free</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

export default function Admin() {
  const { data: tenants, isLoading: tenantsLoading, isError: tenantsError, refetch: refetchTenants } = useAdminTenants();
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();

  if (tenantsError) {
    return (
      <PageContainer title="Administração" subtitle="Acesso restrito">
        <ErrorState description="Sem permissão ou erro ao carregar dados de admin." onRetry={refetchTenants} />
      </PageContainer>
    );
  }

  const isLoading = tenantsLoading || healthLoading || metricsLoading;

  return (
    <PageContainer title="Administração" subtitle="Monitorização do sistema e utilizadores">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" />
                Estado dos Serviços
                {health && (
                  <Badge variant={health.status === "ok" ? "default" : "destructive"} className="ml-2">
                    {health.status === "ok" ? "Tudo operacional" : "Degradado"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {health && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {Object.entries(health.services).map(([name, svc]) => (
                    <div key={name} className="flex items-center gap-3 rounded-lg border p-3">
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

          {/* KPI Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Tenants" value={String(metrics.total_tenants)} icon={Users} />
              <KpiCard label="Pro ativos" value={String(metrics.pro_tenants)} icon={Activity} accent />
              <KpiCard label="Em trial" value={String(metrics.trialing_tenants)} icon={Users} />
              <KpiCard label="Documentos" value={String(metrics.total_documents)} icon={FileText} />
              <KpiCard label="Transações" value={String(metrics.total_transactions)} icon={Landmark} />
              <KpiCard label="Reconciliações" value={String(metrics.total_reconciliations)} icon={GitMerge} />
              <KpiCard label="Docs últimos 30d" value={String(metrics.docs_last_30d)} icon={FileText} />
              <KpiCard label="Valor total docs" value={formatCurrency(metrics.total_document_value)} icon={Landmark} />
              <KpiCard label="Trials expirados" value={String(metrics.expired_tenants)} icon={AlertTriangle} variant="warning" />
              <KpiCard label="Alertas não lidos" value={String(metrics.unread_alerts_global)} icon={AlertTriangle} variant={metrics.unread_alerts_global > 0 ? "danger" : "default"} />
            </div>
          )}

          {/* Tenants Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Utilizadores / Tenants ({tenants?.length || 0})
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
                        <TableCell className="font-mono text-xs max-w-[180px] truncate" title={t.tenant_id}>
                          {t.tenant_id}
                        </TableCell>
                        <TableCell>{planBadge(t.plan, t.status)}</TableCell>
                        <TableCell className="text-right">{t.doc_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(t.doc_total)}</TableCell>
                        <TableCell className="text-right">{t.tx_count}</TableCell>
                        <TableCell className="text-right">{t.recon_count}</TableCell>
                        <TableCell className="text-xs">{formatDate(t.last_activity)}</TableCell>
                        <TableCell className="text-xs">{formatDate(t.trial_end)}</TableCell>
                      </TableRow>
                    ))}
                    {(!tenants || tenants.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          Nenhum tenant registado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
