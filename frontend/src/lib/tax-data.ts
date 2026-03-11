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

export const vatPeriods: VatPeriod[] = [
  { period: "T1 2024", collected: 8420, deductible: 4580, payable: 3840, rate6: 620, rate13: 380, rate23: 7420 },
  { period: "T4 2023", collected: 7800, deductible: 4100, payable: 3700, rate6: 540, rate13: 310, rate23: 6950 },
  { period: "T3 2023", collected: 7200, deductible: 3900, payable: 3300, rate6: 480, rate13: 290, rate23: 6430 },
  { period: "T2 2023", collected: 6900, deductible: 3600, payable: 3300, rate6: 460, rate13: 270, rate23: 6170 },
];

export const vatTrend = [
  { month: "Out", collected: 2500, deductible: 1300 },
  { month: "Nov", collected: 2600, deductible: 1400 },
  { month: "Dez", collected: 2700, deductible: 1400 },
  { month: "Jan", collected: 2800, deductible: 1500 },
  { month: "Fev", collected: 2720, deductible: 1540 },
  { month: "Mar", collected: 2900, deductible: 1540 },
];

export const ircEstimate = {
  revenue: 98400,
  costs: 65200,
  taxableBase: 33200,
  estimatedIrc: 8200,
  rate: 0.21,
  autonomousTax: 420,
  adjustments: [
    { label: "Gastos não aceites fiscalmente", amount: 1200, type: "add" as const },
    { label: "Benefício fiscal PME", amount: -800, type: "subtract" as const },
    { label: "Depreciações acima do limite", amount: 350, type: "add" as const },
  ],
};

export const obligations: Obligation[] = [
  { id: "ob-1", label: "Declaração Periódica IVA — T1 2024", type: "iva", deadline: "15 Abr 2024", daysLeft: 38, status: "em-preparação", description: "Submetida via Portal AT" },
  { id: "ob-2", label: "Retenções na Fonte — Março", type: "irc", deadline: "20 Mar 2024", daysLeft: 12, status: "pronto" },
  { id: "ob-3", label: "Segurança Social — Março", type: "ss", deadline: "10 Mar 2024", daysLeft: 2, status: "pendente" },
  { id: "ob-4", label: "Modelo 22 — IRC 2023", type: "irc", deadline: "31 Mai 2024", daysLeft: 84, status: "em-preparação" },
  { id: "ob-5", label: "IES / Declaração Anual 2023", type: "ies", deadline: "15 Jul 2024", daysLeft: 129, status: "pendente" },
  { id: "ob-6", label: "Pagamento por Conta IRC — 2ª prestação", type: "irc", deadline: "30 Set 2024", daysLeft: 205, status: "pendente" },
  { id: "ob-7", label: "Declaração Periódica IVA — T4 2023", type: "iva", deadline: "15 Fev 2024", daysLeft: -21, status: "concluído" },
];

export const filingReadiness: FilingItem[] = [
  { label: "Documentos classificados", status: "ok", count: 142, detail: "Todos classificados" },
  { label: "Documentos em falta", status: "danger", count: 3, detail: "3 faturas referenciadas sem documento" },
  { label: "Classificações baixa confiança", status: "warning", count: 7, detail: "< 70% confiança IA" },
  { label: "Movimentos por categorizar", status: "warning", count: 5, detail: "Sem conta SNC atribuída" },
  { label: "Reconciliações pendentes", status: "danger", count: 12, detail: "Movimentos sem par documental" },
  { label: "Depreciações por definir", status: "warning", count: 2, detail: "Ativos sem regra de amortização" },
];

export const auditFlags: AuditFlag[] = [
  { id: "af-1", severity: "alta", title: "Despesa EDP 340% acima da média", detail: "Fatura Mar 2024: €890 vs média mensal €202. Verificar regularização.", category: "despesa" },
  { id: "af-2", severity: "alta", title: "Possível duplicação de renda", detail: "Dois pagamentos de €1.200 à Imobiliária Central em 3 dias.", category: "documento" },
  { id: "af-3", severity: "média", title: "IVA em falta em 3 documentos", detail: "Faturas sem tratamento de IVA identificado. Pode afetar declaração.", category: "iva" },
  { id: "af-4", severity: "média", title: "Fornecedor sem NIF válido", detail: "2 transações com entidade não validada fiscalmente.", category: "fornecedor" },
  { id: "af-5", severity: "baixa", title: "Classificação genérica aplicada", detail: "4 movimentos classificados como 'Outros Gastos' — rever subconta.", category: "classificação" },
];
