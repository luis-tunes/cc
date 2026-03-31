import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { FinancialOverviewPanel } from "@/components/dashboard/FinancialOverviewPanel";
import { ReconciliationHealthPanel } from "@/components/dashboard/ReconciliationHealthPanel";
import { DashboardQuickUpload } from "@/components/dashboard/DashboardQuickUpload";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { RecentDocumentsFeed } from "@/components/dashboard/RecentDocumentsFeed";
import { GuidedTour } from "@/components/shared/GuidedTour";
import { DashboardSkeleton } from "@/components/shared/LoadingSkeletons";
import { ErrorState } from "@/components/shared/ErrorState";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useDashboardSummary, useMonthlyData } from "@/hooks/use-dashboard";
import { useTour } from "@/hooks/use-tour";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  Landmark,
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
  const isMobile = useIsMobile();

  const docCount = summary?.documents?.count ?? 0;
  const docTotal = summary?.documents?.total ?? "0";
  const txCount = summary?.bank_transactions?.count ?? 0;
  const txTotal = summary?.bank_transactions?.total ?? "0";
  const reconciled = summary?.reconciliations ?? 0;
  const unmatched = summary?.unmatched_documents ?? 0;

  const hasData = docCount > 0 || txCount > 0;
  const allOnboardingDone = docCount > 0 && txCount > 0 && reconciled > 0;

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

      {/* === ONBOARDING (shown until all steps complete) === */}
      {!isLoading && !allOnboardingDone && (
        <div className="mb-6">
          <OnboardingChecklist docCount={docCount} txCount={txCount} reconciled={reconciled} />
        </div>
      )}

      {/* === QUICK UPLOAD (prominent at top) === */}
      <div className="mb-4">
        <DashboardQuickUpload />
      </div>

      {/* === TOP KPI ROW (4 cards) === */}
      {isLoading ? (
        <div><DashboardSkeleton /></div>
      ) : isMobile ? (
        <Carousel opts={{ align: "start", loop: false }} className="-mx-2">
          <CarouselContent className="-ml-2">
            <CarouselItem className="basis-[75%] pl-2">
              <KpiCard
                label="Documentos"
                value={String(docCount)}
                trend={{ value: formatEUR(docTotal), direction: "neutral" }}
                icon={FileText}
                accent
                sparkline={sparkDocs}
              />
            </CarouselItem>
            <CarouselItem className="basis-[75%] pl-2">
              <KpiCard
                label="Movimentos"
                value={String(txCount)}
                trend={{ value: formatEUR(txTotal), direction: "neutral" }}
                icon={Landmark}
              />
            </CarouselItem>
            <CarouselItem className="basis-[75%] pl-2">
              <KpiCard
                label="Reconciliados"
                value={String(reconciled)}
                trend={{ value: `de ${docCount}`, direction: "neutral" }}
                icon={CheckCircle2}
              />
            </CarouselItem>
            <CarouselItem className="basis-[75%] pl-2">
              <KpiCard
                label="Pendentes"
                value={String(unmatched)}
                trend={{ value: `por reconciliar`, direction: "neutral" }}
                icon={Clock}
                variant="warning"
              />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 tim-stagger-children">
          <KpiCard
            label="Documentos"
            value={String(docCount)}
            trend={{ value: formatEUR(docTotal), direction: "neutral" }}
            icon={FileText}
            accent
            sparkline={sparkDocs}
          />
          <KpiCard
            label="Movimentos"
            value={String(txCount)}
            trend={{ value: formatEUR(txTotal), direction: "neutral" }}
            icon={Landmark}
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
        </div>
      )}

      {/* === DETAIL PANELS (always visible when data exists) === */}
      {hasData && (
        <div className="mt-6 space-y-6">
          {/* Golden divider */}
          <div className="tim-gold-line" />
          <div className="grid gap-6 lg:grid-cols-2">
            <FinancialOverviewPanel />
            <ReconciliationHealthPanel />
          </div>
          <RecentDocumentsFeed />
        </div>
      )}
    </PageContainer>
  );
}
