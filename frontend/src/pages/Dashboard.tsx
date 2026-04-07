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
import { useEntity } from "@/hooks/use-entity";
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

/**
 * Determine the dashboard mode based on setup completeness and data.
 *
 * STATE 1 — "setup": First-time user, little or no configuration.
 *   Onboarding is the hero. KPIs and charts hidden.
 *
 * STATE 2 — "activation": Company setup done, starting to import data.
 *   Onboarding still visible but lighter. KPIs shown.
 *   Quick-upload visible. Charts only when data exists.
 *
 * STATE 3 — "operational": Enough onboarding done + sufficient data.
 *   Full KPI row, reconciliation health, financial charts,
 *   recent documents, alerts. Onboarding hidden.
 */
type DashboardMode = "setup" | "activation" | "operational";

function getDashboardMode(
  hasEntity: boolean,
  hasFinancialContext: boolean,
  docCount: number,
  txCount: number,
  reconciled: number,
): DashboardMode {
  // Operational: entity configured + has both docs and transactions + at least one reconciliation
  if (hasEntity && hasFinancialContext && docCount > 0 && txCount > 0 && reconciled > 0) {
    return "operational";
  }
  // Activation: entity configured OR already has some data
  if (hasEntity || docCount > 0 || txCount > 0) {
    return "activation";
  }
  // Setup: nothing configured yet
  return "setup";
}

export default function Dashboard() {
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();
  const { data: monthly } = useMonthlyData();
  const { data: entityData } = useEntity();
  const tour = useTour();
  const isMobile = useIsMobile();

  const docCount = summary?.documents?.count ?? 0;
  const docTotal = summary?.documents?.total ?? "0";
  const txCount = summary?.bank_transactions?.count ?? 0;
  const txTotal = summary?.bank_transactions?.total ?? "0";
  const reconciled = summary?.reconciliations ?? 0;
  const unmatched = summary?.unmatched_documents ?? 0;
  const classified = summary?.classified ?? 0;

  const hasEntity = !!(entityData?.nif?.trim());
  const hasFinancialContext = !!(entityData?.vatRegime?.trim() && entityData?.accountingRegime?.trim());
  const hasData = docCount > 0 || txCount > 0;

  const mode = isLoading ? "setup" : getDashboardMode(hasEntity, hasFinancialContext, docCount, txCount, reconciled);

  // Sparklines from monthly data (last 6 months, doc count)
  const sparkDocs = useMemo(() =>
    monthly?.slice(-6).map((m) => m.doc_count) ?? [], [monthly]);

  const subtitle = mode === "setup"
    ? "Configure a sua conta para começar"
    : mode === "activation"
      ? "Continue a configurar para desbloquear o modo operacional"
      : "Visão geral da sua operação financeira";

  return (
    <PageContainer
      title="Painel"
      subtitle={subtitle}
    >
      {/* Guided tour overlay */}
      {tour.isActive && (
        <GuidedTour step={tour.step} onNext={tour.next} onSkip={tour.skip} onComplete={tour.complete} />
      )}

      {/* Error state */}
      {isError && <ErrorState onRetry={refetch} />}

      {/* === SETUP MODE: Onboarding is the hero === */}
      {mode === "setup" && !isLoading && (
        <div className="mb-6">
          <OnboardingChecklist docCount={docCount} txCount={txCount} reconciled={reconciled} classified={classified} />
        </div>
      )}

      {/* === ACTIVATION MODE: Onboarding + lighter KPIs + quick upload === */}
      {mode === "activation" && !isLoading && (
        <>
          <div className="mb-6">
            <OnboardingChecklist docCount={docCount} txCount={txCount} reconciled={reconciled} classified={classified} />
          </div>

          {/* Quick upload — shown in activation mode when entity is set up */}
          {hasEntity && (
            <div className="mb-4">
              <DashboardQuickUpload />
            </div>
          )}

          {/* Lighter KPI row — only show cards with data */}
          {hasData && (
            <div className="grid grid-cols-2 gap-3 tim-stagger-children">
              {docCount > 0 && (
                <KpiCard
                  label="Documentos"
                  value={String(docCount)}
                  trend={{ value: formatEUR(docTotal), direction: "neutral" }}
                  icon={FileText}
                  accent
                  compact
                />
              )}
              {txCount > 0 && (
                <KpiCard
                  label="Movimentos"
                  value={String(txCount)}
                  trend={{ value: formatEUR(txTotal), direction: "neutral" }}
                  icon={Landmark}
                  compact
                />
              )}
            </div>
          )}

          {/* Show recent documents if they exist, but no heavy charts */}
          {docCount > 0 && (
            <div className="mt-6">
              <RecentDocumentsFeed />
            </div>
          )}
        </>
      )}

      {/* === OPERATIONAL MODE: Full dashboard === */}
      {mode === "operational" && (
        <>
          {/* Quick upload */}
          <div className="mb-4">
            <DashboardQuickUpload />
          </div>

          {/* Full KPI row */}
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

          {/* Full detail panels */}
          <div className="mt-6 space-y-6">
            <div className="tim-gold-line" />
            <div className="grid gap-6 lg:grid-cols-2">
              <FinancialOverviewPanel />
              <ReconciliationHealthPanel />
            </div>
            <RecentDocumentsFeed />
          </div>
        </>
      )}
    </PageContainer>
  );
}
