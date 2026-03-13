export interface CashFlowPoint {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface ScenarioResult {
  name: string;
  endBalance: number;
  minBalance: number;
  maxBalance: number;
  avgBalance: number;
}

export interface RiskItem {
  id: string;
  title: string;
  detail: string;
  severity: "alta" | "média" | "baixa";
  category: "liquidez" | "prazo" | "receita" | "despesa";
  impact: number;
}

export const scenarioConfig = {
  optimistic: { label: "Otimista", color: "text-tim-success", revenueMultiplier: 1.15, costMultiplier: 0.95 },
  base: { label: "Base", color: "text-primary", revenueMultiplier: 1.0, costMultiplier: 1.0 },
  conservative: { label: "Conservador", color: "text-tim-warning", revenueMultiplier: 0.85, costMultiplier: 1.05 },
};

/** Empty — will be populated from the API. */
export const cashFlowForecast: CashFlowPoint[] = [];
export const scenarioResults: ScenarioResult[] = [];
export const forecastSummary = {
  currentBalance: 0,
  projectedEnd: 0,
  minBalance: 0,
  avgMonthlyInflow: 0,
  avgMonthlyOutflow: 0,
};
export const riskItems: RiskItem[] = [];
