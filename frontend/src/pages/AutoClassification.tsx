import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Zap, Tags, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClassificationStats, useAutoClassify, useClassificationRules } from "@/hooks/use-classifications";
import { useNavigate } from "react-router-dom";
import type { ClassificationRule } from "@/lib/api";

const SNC_LABELS: Record<string, string> = {
  "21": "Fornecedores",
  "22": "Clientes",
  "31": "Compras",
  "62": "FSE",
  "63": "Gastos c/ Pessoal",
  "64": "Depreciações",
  "71": "Vendas",
  "72": "Prest. Serviços",
  "24311": "IVA Dedutível",
  "24321": "IVA Liquidado",
};

const FIELD_PT: Record<string, string> = {
  supplier_nif: "NIF fornecedor",
  description: "descrição",
  amount_gte: "montante ≥",
  amount_lte: "montante ≤",
  type: "tipo",
};

const OPERATOR_PT: Record<string, string> = {
  equals: "é",
  contains: "contém",
  starts_with: "começa com",
  gte: "≥",
  lte: "≤",
};

function ruleDisplayLabel(rule: ClassificationRule): string {
  if (rule.label) return rule.label;
  const field = FIELD_PT[rule.field] ?? rule.field;
  const op = OPERATOR_PT[rule.operator] ?? rule.operator;
  return `${field} ${op} "${rule.value}"`;
}

export default function AutoClassification() {
  const { data: stats, isLoading, isError, refetch } = useClassificationStats();
  const { data: rules = [] } = useClassificationRules();
  const autoClassify = useAutoClassify();
  const navigate = useNavigate();
  const [lastResult, setLastResult] = useState<{
    classified_now: number;
    skipped: number;
    total_processed: number;
  } | null>(null);

  const handleRun = () => {
    autoClassify.mutate(undefined, {
      onSuccess: (result) => {
        setLastResult(result);
        if (result.classified_now > 0) {
          toast.success(`${result.classified_now} documento(s) classificado(s)`, {
            description: `${result.skipped} sem correspondência de regra`,
          });
        } else {
          toast.info("Nenhum documento novo para classificar", {
            description: result.total_processed > 0
              ? `${result.skipped} documentos sem regra correspondente`
              : "Não há documentos por classificar",
          });
        }
      },
      onError: () => toast.error("Erro ao executar classificação automática"),
    });
  };

  const coveragePct = stats?.coverage_pct ?? 0;
  const activeRules = rules.filter((r) => r.active).length;

  if (isError) {
    return (
      <PageContainer title="Auto-Classificação" subtitle="Classificação automática de documentos por regras SNC">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Auto-Classificação"
      subtitle="Classificação automática de documentos por regras SNC"
      actions={
        <Button
          size="sm"
          className="h-9 gap-1.5"
          onClick={handleRun}
          disabled={autoClassify.isPending || activeRules === 0}
        >
          {autoClassify.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {autoClassify.isPending ? "A classificar…" : "Executar agora"}
        </Button>
      }
    >
      {/* No rules warning */}
      {!isLoading && activeRules === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-tim-warning/30 bg-tim-warning/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-tim-warning" />
          <div className="flex-1">
            <p className="text-sm font-medium">Nenhuma regra de classificação ativa</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Crie regras de classificação para que a engine automática possa processar documentos.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 text-xs"
              onClick={() => navigate("/classificacoes")}
            >
              Criar regras <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Last run result */}
      {lastResult && (
        <div className={cn(
          "mb-4 flex items-start gap-3 rounded-lg border p-4",
          lastResult.classified_now > 0
            ? "border-tim-success/30 bg-tim-success/5"
            : "border-tim-info/30 bg-tim-info/5"
        )}>
          <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", lastResult.classified_now > 0 ? "text-tim-success" : "text-tim-info")} />
          <div>
            <p className="text-sm font-medium">
              Última execução: {lastResult.classified_now} documento(s) classificado(s)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lastResult.total_processed} processados · {lastResult.skipped} sem correspondência
            </p>
          </div>
        </div>
      )}

      {/* Coverage KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-muted/20 p-4 h-20" />
          ))
        ) : (
          <>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total documentos</p>
              <p className="mt-1 text-2xl font-semibold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Classificados</p>
              <p className="mt-1 text-2xl font-semibold text-tim-success">{stats?.classified ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Por classificar</p>
              <p className={cn("mt-1 text-2xl font-semibold", (stats?.unclassified ?? 0) > 0 ? "text-tim-warning" : "text-tim-success")}>
                {stats?.unclassified ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Cobertura</p>
              <p className={cn("mt-1 text-2xl font-semibold", coveragePct >= 80 ? "text-tim-success" : coveragePct >= 50 ? "text-tim-warning" : "text-tim-danger")}>
                {coveragePct}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* Coverage bar */}
      {!isLoading && stats && stats.total > 0 && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Cobertura de classificação</span>
            <span className="text-sm text-muted-foreground">{stats.classified}/{stats.total}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", coveragePct >= 80 ? "bg-tim-success" : coveragePct >= 50 ? "bg-tim-warning" : "bg-tim-danger")}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Distribution by account */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Distribuição por conta SNC</h3>
          </div>
          {!stats?.by_account?.length ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Brain className="mr-2 h-4 w-4" /> Sem dados de classificação ainda
            </div>
          ) : (
            <div className="divide-y">
              {stats.by_account.map((row) => {
                const pct = stats.classified > 0 ? Math.round((row.count / stats.classified) * 100) : 0;
                return (
                  <div key={row.account} className="flex items-center gap-3 px-4 py-2.5">
                    <Badge variant="outline" className="shrink-0 font-mono text-xs w-16 justify-center">
                      {row.account}
                    </Badge>
                    <span className="flex-1 truncate text-sm text-muted-foreground">
                      {SNC_LABELS[row.account] ?? "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-medium tabular-nums">{row.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active rules summary */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Regras ativas</h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("/classificacoes")}>
              Gerir <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Tags className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Sem regras criadas</p>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/classificacoes")}>
                Criar primeira regra
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {rules.slice(0, 8).map((rule) => (
                <div key={rule.id} className={cn("flex items-center gap-3 px-4 py-2.5", !rule.active && "opacity-40")}>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", rule.active ? "bg-tim-success" : "bg-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{ruleDisplayLabel(rule)}</p>
                    <p className="text-xs text-muted-foreground">{rule.field} → conta {rule.account}</p>
                  </div>
                  {!rule.active && <Badge variant="outline" className="text-xs shrink-0">inativo</Badge>}
                </div>
              ))}
              {rules.length > 8 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">+{rules.length - 8} regras</div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

