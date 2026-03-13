export interface CostCategory {
  id: string;
  label: string;
  amount: number;
  percentage: number;
  trend: number;
  icon: string;
}

export interface SavingOpportunity {
  id: string;
  title: string;
  description: string;
  potentialSaving: number;
  confidence: number;
  category: string;
  difficulty: "fácil" | "médio" | "difícil";
  status: "novo" | "em-análise" | "implementado" | "descartado";
}

export interface SupplierAnalysis {
  id: string;
  name: string;
  nif: string;
  totalSpent: number;
  invoiceCount: number;
  avgInvoice: number;
  trend: number;
  category: string;
  paymentTerms: string;
  lastInvoice: string;
}

export interface MarginAnalysis {
  category: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

export interface CostBenchmark {
  category: string;
  yourSpend: number;
  sectorAvg: number;
  difference: number;
  rating: "abaixo" | "na-média" | "acima";
}

/** Empty — will be populated from the API. */
export const costCategories: CostCategory[] = [];
export const savingOpportunities: SavingOpportunity[] = [];
export const supplierAnalysis: SupplierAnalysis[] = [];
export const marginAnalysis: MarginAnalysis[] = [];
export const costSummary = {
  totalCosts: 0,
  totalSavingsPotential: 0,
  topCategory: "",
  anomaliesFound: 0,
  benchmarkRating: "",
};
