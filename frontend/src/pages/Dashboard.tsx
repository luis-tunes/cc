import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { FinancialOverviewPanel } from "@/components/dashboard/FinancialOverviewPanel";
import { ReconciliationHealthPanel } from "@/components/dashboard/ReconciliationHealthPanel";
import { CompliancePanel } from "@/components/dashboard/CompliancePanel";
import { AiRecommendationsPanel } from "@/components/dashboard/AiRecommendationsPanel";
import { MorningBriefingCard } from "@/components/dashboard/MorningBriefingCard";
import { DashboardComplianceStrip } from "@/components/alerts/DashboardComplianceStrip";
import { DashboardQuickUpload } from "@/components/dashboard/DashboardQuickUpload";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Landmark,
  AlertTriangle,
  CalendarCheck,
  FileText,
  GitMerge,
  Loader2,
} from "lucide-react";

function formatEUR(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "€0";
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useDashboardSummary();

  const docCount = summary?.documents?.count ?? 0;
  const docTotal = summary?.documents?.total ?? "0";
  const txCount = summary?.bank_transactions?.count ?? 0;
  const txTotal = summary?.bank_transactions?.total ?? "0";
  const reconciled = summary?.reconciliations ?? 0;
  const unmatched = summary?.unmatched_documents ?? 0;
  const pendingReview = summary?.pending_review ?? 0;
  const classified = summary?.classified ?? 0;

  return (
    <PageContainer
      title="Painel"
      subtitle="Visão geral da sua operação financeira"
    >
      {/* === 1. TOP KPI ROW === */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="Documentos"
          value={isLoading ? "…" : String(docCount)}
          trend={{ value: formatEUR(docTotal), direction: "neutral" }}
          icon={FileText}
          accent
          compact
        />
        <KpiCard
          label="Movimentos"
          value={isLoading ? "…" : String(txCount)}
          trend={{ value: formatEUR(txTotal), direction: "neutral" }}
          icon={Landmark}
          compact
        />
        <KpiCard
          label="Reconciliados"
          value={isLoading ? "…" : String(reconciled)}
          trend={{ value: `de ${docCount}`, direction: "neutral" }}
          icon={GitMerge}
          compact
        />
        <KpiCard
          label="IVA Estimado"
          value={isLoading ? "…" : "—"}
          icon={Receipt}
          trend={{ value: "T1 2024", direction: "neutral" }}
          variant="warning"
          compact
        />
        <KpiCard
          label="Por Classificar"
          value={isLoading ? "…" : String(pendingReview)}
          icon={FileText}
          variant="warning"
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
        <KpiCard
          label="Classificados"
          value={isLoading ? "…" : String(classified)}
          icon={CalendarCheck}
          compact
        />
        <KpiCard
          label="Alertas"
          value="—"
          icon={AlertTriangle}
          trend={{ value: "Anomalias", direction: "neutral" }}
          variant="danger"
          compact
        />
      </div>

      {/* === 1b. QUICK UPLOAD + COMPLIANCE STRIP === */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DashboardQuickUpload />
        <DashboardComplianceStrip />
      </div>

      {/* === 2. FINANCIAL OVERVIEW === */}
      <div className="mt-6">
        <FinancialOverviewPanel />
      </div>

      {/* === 3, 4, 5, 6. OPERATIONAL PANELS === */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Reconciliation + Compliance stacked */}
        <div className="space-y-6 lg:col-span-1">
          <ReconciliationHealthPanel />
          <CompliancePanel />
        </div>

        {/* Center: AI Recommendations */}
        <div className="lg:col-span-1">
          <AiRecommendationsPanel />
        </div>

        {/* Right: Morning Briefing */}
        <div className="lg:col-span-1">
          <MorningBriefingCard />
        </div>
      </div>
    </PageContainer>
  );
}
