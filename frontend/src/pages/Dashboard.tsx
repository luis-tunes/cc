import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { FinancialOverviewPanel } from "@/components/dashboard/FinancialOverviewPanel";
import { ReconciliationHealthPanel } from "@/components/dashboard/ReconciliationHealthPanel";
import { CompliancePanel } from "@/components/dashboard/CompliancePanel";
import { AiRecommendationsPanel } from "@/components/dashboard/AiRecommendationsPanel";
import { MorningBriefingCard } from "@/components/dashboard/MorningBriefingCard";
import { DashboardComplianceStrip } from "@/components/alerts/DashboardComplianceStrip";
import { DashboardQuickUpload } from "@/components/dashboard/DashboardQuickUpload";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Landmark,
  AlertTriangle,
  CalendarCheck,
  FileText,
  GitMerge,
} from "lucide-react";

export default function Dashboard() {
  return (
    <PageContainer
      title="Painel"
      subtitle="Visão geral da sua operação financeira — 8 Março 2024"
    >
      {/* === 1. TOP KPI ROW === */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="Receita"
          value="€24.580"
          trend={{ value: "+12,3%", direction: "up" }}
          accent
          compact
        />
        <KpiCard
          label="Gastos"
          value="€16.340"
          trend={{ value: "+4,1%", direction: "down" }}
          compact
        />
        <KpiCard
          label="Resultado"
          value="€8.240"
          trend={{ value: "+28%", direction: "up" }}
          compact
        />
        <KpiCard
          label="IVA Estimado"
          value="€3.840"
          icon={Receipt}
          trend={{ value: "T1 2024", direction: "neutral" }}
          variant="warning"
          compact
        />
        <KpiCard
          label="Por Classificar"
          value="13"
          icon={FileText}
          trend={{ value: "+5 hoje", direction: "up" }}
          variant="warning"
          compact
        />
        <KpiCard
          label="Por Reconciliar"
          value="24"
          icon={GitMerge}
          trend={{ value: "de 142", direction: "neutral" }}
          variant="warning"
          compact
        />
        <KpiCard
          label="Obrigações"
          value="2"
          icon={CalendarCheck}
          trend={{ value: "< 15 dias", direction: "neutral" }}
          variant="warning"
          compact
        />
        <KpiCard
          label="Alertas"
          value="3"
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
