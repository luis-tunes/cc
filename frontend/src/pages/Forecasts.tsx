import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { CashFlowChart } from "@/components/forecasts/CashFlowChart";
import { ScenarioToggle } from "@/components/forecasts/ScenarioToggle";
import { ForecastRisksPanel } from "@/components/forecasts/ForecastRisksPanel";
import { AiCommentaryPanel } from "@/components/forecasts/AiCommentaryPanel";
import { ForecastTable } from "@/components/forecasts/ForecastTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { forecastScenarios, forecastWeeks, forecastSummary } from "@/lib/forecast-data";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertTriangle,
  Calendar,
} from "lucide-react";

export default function Forecasts() {
  const [activeScenario, setActiveScenario] = useState("base");
  const scenario = forecastScenarios.find((s) => s.id === activeScenario)!;

  return (
    <PageContainer
      title="Previsão de Tesouraria"
      subtitle="Projeção de cash flow a 8 semanas — cenários e riscos operacionais"
      actions={
        <ScenarioToggle
          scenarios={forecastScenarios}
          active={activeScenario}
          onChange={setActiveScenario}
        />
      }
    >
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Saldo Atual"
          value={`€${forecastSummary.currentBalance.toLocaleString("pt-PT")}`}
          icon={Wallet}
          accent
          compact
        />
        <KpiCard
          label="Entradas (8 sem.)"
          value={`€${forecastSummary.totalInflows.toLocaleString("pt-PT")}`}
          icon={TrendingUp}
          trend={{ value: "projetado", direction: "neutral" }}
          compact
        />
        <KpiCard
          label="Saídas (8 sem.)"
          value={`€${Math.round(forecastSummary.totalOutflows * scenario.modifier).toLocaleString("pt-PT")}`}
          icon={TrendingDown}
          trend={{
            value: scenario.id !== "base" ? `${scenario.label}` : "base",
            direction: scenario.modifier > 1 ? "down" : scenario.modifier < 1 ? "up" : "neutral",
          }}
          compact
        />
        <KpiCard
          label="Obrig. Fiscais"
          value={`€${forecastSummary.totalTax.toLocaleString("pt-PT")}`}
          icon={Receipt}
          variant="warning"
          compact
        />
        <KpiCard
          label="Riscos Ativos"
          value={`${forecastSummary.allRisks.length}`}
          icon={AlertTriangle}
          variant={forecastSummary.allRisks.some((r) => r.severity === "critico") ? "danger" : "warning"}
          compact
        />
        <KpiCard
          label="Mín. Projetado"
          value={`€${Math.round(forecastSummary.projectedMin * scenario.modifier).toLocaleString("pt-PT")}`}
          icon={Calendar}
          trend={{ value: "banda inferior", direction: "neutral" }}
          compact
        />
      </div>

      {/* Scenario description */}
      {activeScenario !== "base" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-tim-warning/20 bg-tim-warning/5 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-tim-warning" />
          <p className="text-xs text-foreground/80">
            <span className="font-semibold text-tim-warning">{scenario.label}:</span>{" "}
            {scenario.description}
          </p>
        </div>
      )}

      {/* Main chart */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold">Projeção de Cash Flow</CardTitle>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-tim-success" /> Entradas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-tim-danger/70" /> Saídas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-tim-warning" /> Fiscal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 rounded-full bg-primary" /> Saldo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-tim-danger" /> Risco
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <CashFlowChart
            weeks={forecastWeeks}
            scenarioModifier={scenario.modifier}
          />
        </CardContent>
      </Card>

      {/* Bottom grid: Table + Risks + AI */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ForecastTable weeks={forecastWeeks} scenarioModifier={scenario.modifier} />
        </div>
        <div className="space-y-6">
          <ForecastRisksPanel risks={forecastSummary.allRisks} />
          <AiCommentaryPanel />
        </div>
      </div>
    </PageContainer>
  );
}
