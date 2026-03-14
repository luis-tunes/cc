import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { FinancialOverviewPanel } from "@/components/dashboard/FinancialOverviewPanel";
import { ReconciliationHealthPanel } from "@/components/dashboard/ReconciliationHealthPanel";
import { DashboardQuickUpload } from "@/components/dashboard/DashboardQuickUpload";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { RecentDocumentsFeed } from "@/components/dashboard/RecentDocumentsFeed";
import { useDashboardSummary, useMonthlyData } from "@/hooks/use-dashboard";
import { useMemo } from "react";
import {
  FileText,
  Landmark,
  GitMerge,
} from "lucide-react";

function formatEUR(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "€0";
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: monthly } = useMonthlyData();

  const docCount = summary?.documents?.count ?? 0;
  const docTotal = summary?.documents?.total ?? "0";
  const txCount = summary?.bank_transactions?.count ?? 0;
  const txTotal = summary?.bank_transactions?.total ?? "0";
  const reconciled = summary?.reconciliations ?? 0;
  const unmatched = summary?.unmatched_documents ?? 0;

  const hasData = docCount > 0 || txCount > 0;

  // Sparklines from monthly data (last 6 months, doc count)
  const sparkDocs = useMemo(() =>
    monthly?.slice(-6).map((m) => m.doc_count) ?? [], [monthly]);
  const sparkRevenue = useMemo(() =>
    monthly?.slice(-6).map((m) => parseFloat(m.total) || 0) ?? [], [monthly]);

  return (
    <PageContainer
      title="Painel"
      subtitle="Visão geral da sua operação financeira"
    >
      {/* === ONBOARDING (shown when no data yet) === */}
      {!isLoading && !hasData && (
        <div className="mb-6">
          <OnboardingChecklist docCount={docCount} txCount={txCount} reconciled={reconciled} />
        </div>
      )}

      {/* === TOP KPI ROW === */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Documentos"
          value={isLoading ? "…" : String(docCount)}
          trend={{ value: formatEUR(docTotal), direction: "neutral" }}
          icon={FileText}
          accent
          compact
          sparkline={sparkDocs}
        />
        <KpiCard
          label="Volume"
          value={isLoading ? "…" : formatEUR(docTotal)}
          trend={{ value: `${docCount} docs`, direction: "neutral" }}
          icon={Landmark}
          compact
          sparkline={sparkRevenue}
        />
        <KpiCard
          label="Reconciliados"
          value={isLoading ? "…" : String(reconciled)}
          trend={{ value: `de ${docCount}`, direction: "neutral" }}
          icon={GitMerge}
          compact
        />
        <KpiCard
          label="Por Reconciliar"
          value={isLoading ? "…" : String(unmatched)}
          icon={GitMerge}
          trend={{ value: `de ${docCount}`, direction: "neutral" }}
          variant="warning"
          compact
        />
      </div>

      {/* === QUICK UPLOAD === */}
      <div className="mt-4">
        <DashboardQuickUpload />
      </div>

      {/* === OPERATIONAL PANELS (only shown when there's data) === */}
      {hasData && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <FinancialOverviewPanel />
            <ReconciliationHealthPanel />
          </div>
          <div className="mt-6">
            <RecentDocumentsFeed />
          </div>
        </>
      )}
    </PageContainer>
  );
}
