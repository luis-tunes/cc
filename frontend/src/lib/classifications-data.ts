import { type StatusType } from "@/components/shared/StatusBadge";

export interface SncClass {
  code: number;
  label: string;
  accounts: SncAccount[];
}

export interface SncAccount {
  code: string;
  label: string;
  movementCount: number;
  totalAmount: number;
  hasWarning?: boolean;
  warningText?: string;
}

export interface ClassificationQueueItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "debito" | "credito";
  suggestedAccount: string;
  suggestedClass: string;
  confidence: number;
  explanation: string;
  detectedEntity?: string;
  status: "pendente" | "sugerido" | "aprovado" | "rejeitado";
}

export interface ClassificationRule {
  id: string;
  type: "fornecedor" | "padrão" | "correção" | "atalho";
  pattern: string;
  account: string;
  accountLabel: string;
  timesApplied: number;
  confidence: number;
  source: "ia" | "manual";
  lastUsed: string;
}

export interface TaxonomyMapping {
  code: string;
  label: string;
  sncAccount: string;
  status: "mapeado" | "parcial" | "em-falta";
  warningText?: string;
}

export const entityContext = {
  name: "Empresa Demo, Lda.",
  nif: "514 123 456",
  cae: "62010 — Atividades de programação informática",
  regime: "Regime Geral — SNC Microentidades",
  sector: "Tecnologia / Serviços",
  profile: "PME — Prestação de Serviços",
};

export const sncClasses: SncClass[] = [
  {
    code: 1, label: "Meios Financeiros Líquidos",
    accounts: [
      { code: "11", label: "Caixa", movementCount: 3, totalAmount: 1200 },
      { code: "12", label: "Depósitos à Ordem", movementCount: 142, totalAmount: 98400 },
      { code: "13", label: "Outros Depósitos Bancários", movementCount: 0, totalAmount: 0 },
    ],
  },
  {
    code: 2, label: "Contas a Receber e a Pagar",
    accounts: [
      { code: "21", label: "Clientes", movementCount: 28, totalAmount: 42600 },
      { code: "22", label: "Fornecedores", movementCount: 45, totalAmount: 38200 },
      { code: "24", label: "Estado e Outros Entes Públicos", movementCount: 12, totalAmount: 8900 },
      { code: "25", label: "Financiamentos Obtidos", movementCount: 2, totalAmount: 15000 },
      { code: "27", label: "Outras Contas a Receber e a Pagar", movementCount: 4, totalAmount: 3200 },
    ],
  },
  {
    code: 3, label: "Inventários e Ativos Biológicos",
    accounts: [
      { code: "31", label: "Compras", movementCount: 0, totalAmount: 0, hasWarning: true, warningText: "Sem movimentos — verificar se aplicável ao CAE" },
      { code: "32", label: "Mercadorias", movementCount: 0, totalAmount: 0 },
    ],
  },
  {
    code: 4, label: "Investimentos",
    accounts: [
      { code: "43", label: "Ativos Fixos Tangíveis", movementCount: 3, totalAmount: 12400 },
      { code: "44", label: "Ativos Intangíveis", movementCount: 1, totalAmount: 2800 },
      { code: "48", label: "Amortizações Acumuladas", movementCount: 6, totalAmount: 4200, hasWarning: true, warningText: "2 ativos sem regra de depreciação" },
    ],
  },
  {
    code: 5, label: "Capital Próprio",
    accounts: [
      { code: "51", label: "Capital", movementCount: 0, totalAmount: 25000 },
      { code: "56", label: "Resultados Transitados", movementCount: 0, totalAmount: 8400 },
    ],
  },
  {
    code: 6, label: "Gastos",
    accounts: [
      { code: "61", label: "CMVMC", movementCount: 0, totalAmount: 0 },
      { code: "62", label: "Fornecimentos e Serviços Externos", movementCount: 34, totalAmount: 28600 },
      { code: "63", label: "Gastos com Pessoal", movementCount: 8, totalAmount: 18200 },
      { code: "64", label: "Gastos de Depreciação e Amortização", movementCount: 6, totalAmount: 4200 },
      { code: "68", label: "Outros Gastos e Perdas", movementCount: 5, totalAmount: 890, hasWarning: true, warningText: "4 movimentos com classificação genérica" },
      { code: "69", label: "Gastos e Perdas de Financiamento", movementCount: 2, totalAmount: 340 },
    ],
  },
  {
    code: 7, label: "Rendimentos",
    accounts: [
      { code: "71", label: "Vendas", movementCount: 4, totalAmount: 8200 },
      { code: "72", label: "Prestações de Serviços", movementCount: 24, totalAmount: 86400 },
      { code: "78", label: "Outros Rendimentos e Ganhos", movementCount: 2, totalAmount: 1800 },
    ],
  },
  {
    code: 8, label: "Resultados",
    accounts: [
      { code: "81", label: "Resultado Líquido do Período", movementCount: 0, totalAmount: 0 },
    ],
  },
];

export const classificationQueue: ClassificationQueueItem[] = [
  { id: "cq-1", date: "2024-03-08", description: "DEPOSITO NUMERARIO", amount: 1000, type: "credito", suggestedAccount: "—", suggestedClass: "—", confidence: 15, explanation: "Depósito sem referência. Sem correspondência com clientes ou faturas.", status: "pendente" },
  { id: "cq-2", date: "2024-03-07", description: "PAGAMENTO EDP COMERCIAL", amount: -890, type: "debito", suggestedAccount: "62.2.1", suggestedClass: "62 — FSE", confidence: 72, explanation: "Fornecedor de utilities. Montante 340% acima da média — possível regularização.", detectedEntity: "EDP Comercial", status: "sugerido" },
  { id: "cq-3", date: "2024-03-04", description: "TRANSF P/ CONSULTORIA PRO SA", amount: -3600, type: "debito", suggestedAccount: "62.2.2", suggestedClass: "62 — FSE", confidence: 88, explanation: "Novo fornecedor. Fatura correspondente localizada.", detectedEntity: "Consultoria Pro, S.A.", status: "sugerido" },
  { id: "cq-4", date: "2024-03-02", description: "TRANSF DE XYZ SERVICOS LDA", amount: 320, type: "credito", suggestedAccount: "62.1.1", suggestedClass: "62 — FSE (NC)", confidence: 82, explanation: "Crédito de fornecedor — nota de crédito identificada.", detectedEntity: "XYZ Serviços, Lda.", status: "sugerido" },
  { id: "cq-5", date: "2024-03-01", description: "TRANSF P/ IMOBILIARIA CENTRAL (DUP?)", amount: -1200, type: "debito", suggestedAccount: "62.2.3", suggestedClass: "62 — FSE", confidence: 45, explanation: "Possível duplicação. Mesmo valor e fornecedor 2 dias antes.", detectedEntity: "Imobiliária Central", status: "pendente" },
];

export const classificationRules: ClassificationRule[] = [
  { id: "r-1", type: "fornecedor", pattern: "ABC Materiais, Lda.", account: "62.1.1", accountLabel: "Subcontratos", timesApplied: 14, confidence: 96, source: "ia", lastUsed: "2024-03-08" },
  { id: "r-2", type: "fornecedor", pattern: "EDP Comercial", account: "62.2.1", accountLabel: "Eletricidade", timesApplied: 11, confidence: 94, source: "ia", lastUsed: "2024-03-07" },
  { id: "r-3", type: "padrão", pattern: "COMISSAO MANUTENCAO CONTA", account: "68.1", accountLabel: "Outros Gastos — Bancários", timesApplied: 24, confidence: 98, source: "ia", lastUsed: "2024-03-05" },
  { id: "r-4", type: "fornecedor", pattern: "Imobiliária Central", account: "62.2.3", accountLabel: "Rendas e Alugueres", timesApplied: 8, confidence: 91, source: "manual", lastUsed: "2024-03-03" },
  { id: "r-5", type: "padrão", pattern: "TRANSF SEG SOCIAL*", account: "24.5", accountLabel: "Segurança Social", timesApplied: 12, confidence: 99, source: "ia", lastUsed: "2024-03-06" },
  { id: "r-6", type: "correção", pattern: "Serviços genéricos → FSE", account: "62.2.2", accountLabel: "Serviços Especializados", timesApplied: 3, confidence: 85, source: "manual", lastUsed: "2024-02-28" },
];

export const taxonomyMappings: TaxonomyMapping[] = [
  { code: "S.01.01", label: "Vendas de mercadorias", sncAccount: "71", status: "mapeado" },
  { code: "S.01.02", label: "Prestações de serviços", sncAccount: "72", status: "mapeado" },
  { code: "S.02.01", label: "CMVMC", sncAccount: "61", status: "em-falta", warningText: "Sem movimentos — verificar se taxonomia aplicável" },
  { code: "S.02.02", label: "Fornecimentos e serviços externos", sncAccount: "62", status: "mapeado" },
  { code: "S.02.03", label: "Gastos com pessoal", sncAccount: "63", status: "mapeado" },
  { code: "S.02.04", label: "Depreciações e amortizações", sncAccount: "64", status: "parcial", warningText: "2 subcontas sem mapeamento" },
  { code: "S.02.05", label: "Outros gastos e perdas", sncAccount: "68", status: "parcial", warningText: "Classificações genéricas presentes" },
  { code: "S.03.01", label: "Imposto sobre o rendimento", sncAccount: "81", status: "em-falta", warningText: "Apuramento pendente" },
];
