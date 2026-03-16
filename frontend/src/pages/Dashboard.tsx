import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { FinancialOverviewPanel } from "@/components/dashboard/FinancialOverviewPanel";
import { ReconciliationHealthPanel } from "@/components/dashboard/ReconciliationHealthPanel";
import { DashboardQuickUpload } from "@/components/dashboard/DashboardQuickUpload";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { RecentDocumentsFeed } from "@/components/dashboard/RecentDocumentsFeed";
import { GuidedTour } from "@/components/shared/GuidedTour";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useDashboardSummary, useMonthlyData } from "@/hooks/use-dashboard";
import { useTour } from "@/hooks/use-tour";
import { useMemo, useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  ChevronDown,
} from "lucide-react";

function formatEUR(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "€0";
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();
  const { data: monthly } = useMonthlyData();
  const tour = useTour();
  const [showDetails, setShowDetails] = useState(false);

  const docCount = summary?.documents?.count ?? 0;
  const docTotal = summary?.documents?.total ?? "0";
  const txCount = summary?.bank_transactions?.count ?? 0;
  const reconciled = summary?.reconciliations ?? 0;
  const unmatched = summary?.unmatched_documents ?? 0;

  const hasData = docCount > 0 || txCount > 0;

  // Sparklines from monthly data (last 6 months, doc count)
  const sparkDocs = useMemo(() =>
    monthly?.slice(-6).map((m) => m.doc_count) ?? [], [monthly]);

  return (
    <PageContainer
      title="Painel"
      subtitle="Visão geral da sua operação financeira"
    >
      {/* Guided tour overlay */}
      {tour.isActive && (
        <GuidedTour step={tour.step} onNext={tour.next} onSkip={tour.skip} onComplete={tour.complete} />
      )}

      {/* Error state */}
      {isError && <ErrorState onRetry={refetch} />}

      {/* === ONBOARDING (shown when no data yet) === */}
      {!isLoading && !hasData && (
        <div className="mb-6">
          <OnboardingChecklist docCount={docCount} txCount={txCount} reconciled={reconciled} />
        </div>
      )}

      {/* === TOP KPI ROW (3 cards) === */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </>
        ) : (
          <>
            <KpiCard
              label="Documentos"
              value={String(docCount)}
              trend={{ value: formatEUR(docTotal), direction: "neutral" }}
              icon={FileText}
              accent
              sparkline={sparkDocs}
            />
            <KpiCard
              label="Reconciliados"
              value={String(reconciled)}
              trend={{ value: `de ${docCount}`, direction: "neutral" }}
              icon={CheckCircle2}
            />
            <KpiCard
              label="Pendentes"
              value={String(unmatched)}
              trend={{ value: `por reconciliar`, direction: "neutral" }}
              icon={Clock}
              variant="warning"
            />
          </>
        )}
      </div>

      {/* === QUICK UPLOAD === */}
      <div className="mt-4">
        <DashboardQuickUpload />
      </div>

      {/* === DETAILED PANELS (collapsible) === */}
      {hasData && (
        <div className="mt-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            Ver detalhes
          </button>
          {showDetails && (
            <div className="mt-4 space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <FinancialOverviewPanel />
                <ReconciliationHealthPanel />
              </div>
              <RecentDocumentsFeed />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
