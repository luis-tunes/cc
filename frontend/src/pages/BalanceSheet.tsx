import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBalanceSheet } from "@/hooks/use-accounting";

function fmt(v: string) {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

function SectionTable({ title, items, colorClass }: { title: string; items: { code: string; name: string; balance: string }[]; colorClass: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card">
      <div className={cn("border-b px-4 py-2", colorClass)}>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.code} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">{item.code}</span>
              <span className="text-sm">{item.name}</span>
            </div>
            <span className="font-mono text-sm font-medium">{fmt(item.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BalanceSheet() {
  const [asOf, setAsOf] = useState("");

  const { data, isLoading, error } = useBalanceSheet(asOf || undefined);

  if (error) return <PageContainer title="Balanço"><ErrorState title="Erro ao carregar balanço" /></PageContainer>;

  return (
    <PageContainer
      title="Balanço"
      subtitle="Balanço patrimonial — situação financeira"
    >
      {/* Date filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">À data de:</span>
          <Input type="date" className="w-[160px]" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        {data && (
          <div className="ml-auto">
            {data.balanced ? (
              <Badge variant="outline" className="bg-tim-success/15 text-tim-success border-tim-success/30 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Balanceado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-tim-warning/15 text-tim-warning border-tim-warning/30 gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Não balanceado
              </Badge>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : !data ? (
        <EmptyState
          icon={Scale}
          title="Sem dados no balanço"
          description="Crie lançamentos contabilísticos para ver o balanço patrimonial."
        />
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ativo" value={fmt(data.assets)} />
            <KpiCard label="Passivo" value={fmt(data.liabilities)} />
            <KpiCard label="Capital Próprio" value={fmt(data.equity)} />
            <KpiCard
              label="Resultado Líquido"
              value={fmt(data.net_income)}
              trend={{
                value: parseFloat(data.net_income) >= 0 ? "Lucro" : "Prejuízo",
                direction: parseFloat(data.net_income) >= 0 ? "up" : "down",
              }}
            />
          </div>

          {/* Balance equation */}
          <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Equação fundamental</p>
            <p className="text-lg font-semibold">
              <span className="text-tim-info">Ativo</span>
              {" = "}
              <span className="text-tim-danger">Passivo</span>
              {" + "}
              <span className="text-purple-600 dark:text-purple-400">Capital Próprio</span>
            </p>
            <p className="text-sm font-mono mt-1">
              {fmt(data.assets)} = {fmt(data.equity_plus_liabilities)}
            </p>
          </div>

          {/* Detail sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Ativo</h2>
              {data.detail.asset && data.detail.asset.length > 0 ? (
                <SectionTable title="Contas do Ativo" items={data.detail.asset} colorClass="bg-tim-info/10" />
              ) : (
                <p className="text-sm text-muted-foreground">Sem contas de ativo com saldo.</p>
              )}
            </div>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Passivo + Capital Próprio</h2>
              {data.detail.liability && data.detail.liability.length > 0 && (
                <SectionTable title="Passivo" items={data.detail.liability} colorClass="bg-tim-danger/10" />
              )}
              {data.detail.equity && data.detail.equity.length > 0 && (
                <SectionTable title="Capital Próprio" items={data.detail.equity} colorClass="bg-primary/10" />
              )}
              {(!data.detail.liability || data.detail.liability.length === 0) &&
               (!data.detail.equity || data.detail.equity.length === 0) && (
                <p className="text-sm text-muted-foreground">Sem contas de passivo ou capital próprio com saldo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
