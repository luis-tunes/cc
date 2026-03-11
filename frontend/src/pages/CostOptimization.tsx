import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { CostBreakdownPanel } from "@/components/optimization/CostBreakdownPanel";
import { SupplierRiskPanel } from "@/components/optimization/SupplierRiskPanel";
import { MarginIndicatorsPanel } from "@/components/optimization/MarginIndicatorsPanel";
import { RecommendationsPanel } from "@/components/optimization/RecommendationsPanel";
import { costSummary } from "@/lib/cost-optimization-data";
import {
  Scissors,
  TrendingDown,
  RefreshCw,
  Target,
  AlertTriangle,
  Brain,
} from "lucide-react";

function pctChange(current: number, previous: number) {
  return ((current - previous) / previous) * 100;
}

export default function CostOptimization() {
  const costChange = pctChange(costSummary.totalCosts, costSummary.previousTotalCosts);

  return (
    <PageContainer
      title="Otimização de Custos"
      subtitle="Análise de custos, concentração de fornecedores e oportunidades de melhoria de margem"
    >
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Custos Totais"
          value={`€${costSummary.totalCosts.toLocaleString("pt-PT")}`}
          icon={TrendingDown}
          trend={{
            value: `${costChange > 0 ? "+" : ""}${costChange.toFixed(1)}% vs. ant.`,
            direction: costChange > 0 ? "down" : "up",
          }}
          compact
        />
        <KpiCard
          label="Custos Recorrentes"
          value={`€${costSummary.recurringCosts.toLocaleString("pt-PT")}`}
          icon={RefreshCw}
          trend={{
            value: `${((costSummary.recurringCosts / costSummary.totalCosts) * 100).toFixed(0)}% do total`,
            direction: "neutral",
          }}
          compact
        />
        <KpiCard
          label="Custos / Receita"
          value={`${((costSummary.totalCosts / costSummary.revenue) * 100).toFixed(1)}%`}
          icon={Target}
          variant="warning"
          compact
        />
        <KpiCard
          label="Poupança Potencial"
          value={`€${costSummary.totalPotentialSavings.toLocaleString("pt-PT")}/ano`}
          icon={Scissors}
          accent
          compact
        />
        <KpiCard
          label="Recom. Alta Confiança"
          value={`${costSummary.highConfidenceRecs}`}
          icon={Brain}
          trend={{ value: "≥80% confiança", direction: "neutral" }}
          compact
        />
        <KpiCard
          label="Riscos Fornecedor"
          value="2"
          icon={AlertTriangle}
          variant="danger"
          trend={{ value: "concentração alta", direction: "neutral" }}
          compact
        />
      </div>

      {/* Main content grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Left column: Cost breakdown + Supplier risk */}
        <div className="space-y-6 lg:col-span-2">
          <CostBreakdownPanel />
          <SupplierRiskPanel />
        </div>

        {/* Right column: Recommendations + Margin indicators */}
        <div className="space-y-6 lg:col-span-3">
          <RecommendationsPanel />
          <MarginIndicatorsPanel />
        </div>
      </div>
    </PageContainer>
  );
}
