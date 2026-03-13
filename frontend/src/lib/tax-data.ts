export interface VatPeriod {
  period: string;
  collected: number;
  deductible: number;
  payable: number;
  rate6: number;
  rate13: number;
  rate23: number;
}

export interface Obligation {
  id: string;
  label: string;
  type: "iva" | "irc" | "ies" | "ss" | "outro";
  deadline: string;
  daysLeft: number;
  status: "concluído" | "pronto" | "em-preparação" | "pendente" | "atrasado";
  description?: string;
}

export interface FilingItem {
  label: string;
  status: "ok" | "warning" | "danger";
  count?: number;
  detail: string;
}

export interface AuditFlag {
  id: string;
  severity: "alta" | "média" | "baixa";
  title: string;
  detail: string;
  category: "despesa" | "documento" | "iva" | "fornecedor" | "classificação";
}

/** Empty — will be populated from the API. */
export const vatPeriods: VatPeriod[] = [];
export const vatTrend: { month: string; collected: number; deductible: number }[] = [];
export const ircEstimate = {
  revenue: 0,
  costs: 0,
  taxableBase: 0,
  estimatedIrc: 0,
  rate: 0,
  autonomousTax: 0,
  adjustments: [] as { label: string; amount: number; type: "add" | "subtract" }[],
};
export const obligations: Obligation[] = [];
export const filingReadiness: FilingItem[] = [];
export const auditFlags: AuditFlag[] = [];
