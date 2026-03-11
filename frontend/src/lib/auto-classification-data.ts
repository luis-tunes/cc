export interface AutoClassificationItem {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  type: "debito" | "credito";
  suggestedAccount: string;
  suggestedClass: string;
  confidence: number;
  explanation: string;
  detectedEntity?: string;
  detectedEntityType?: "fornecedor" | "cliente";
  status: "pendente" | "sugerido" | "aprovado" | "rejeitado" | "editado";
  isRecurring?: boolean;
  isDuplicate?: boolean;
  isAnomaly?: boolean;
  historicalPattern?: {
    matchCount: number;
    lastSeen: string;
    avgAmount: number;
    consistentAccount: boolean;
  };
  sourceData: string[];
  linkedDocumentName?: string;
  supplierRule?: {
    exists: boolean;
    ruleId?: string;
    pattern?: string;
  };
}

export const autoClassificationQueue: AutoClassificationItem[] = [
  {
    id: "ac-1",
    date: "2024-03-08",
    description: "DEPOSITO NUMERARIO",
    amount: 1000,
    type: "credito",
    suggestedAccount: "—",
    suggestedClass: "—",
    confidence: 15,
    explanation: "Depósito em numerário sem referência identificável. Sem correspondência com clientes ou faturas conhecidas no sistema. Requer classificação manual.",
    status: "pendente",
    isAnomaly: true,
    sourceData: ["Extrato bancário CSV (linha 47)", "Base de clientes (0 correspondências)", "Faturas em aberto (0 correspondências)"],
    supplierRule: { exists: false },
  },
  {
    id: "ac-2",
    date: "2024-03-07",
    description: "PAGAMENTO EDP COMERCIAL",
    reference: "DD-EDP-MAR24",
    amount: -890,
    type: "debito",
    suggestedAccount: "62.2.1",
    suggestedClass: "62 — Fornecimentos e Serviços Externos",
    confidence: 72,
    explanation: "Fornecedor de utilities identificado por padrão de descrição. Montante 340% acima da média mensal (€202). Possível fatura de regularização ou erro de débito direto.",
    detectedEntity: "EDP Comercial",
    detectedEntityType: "fornecedor",
    status: "sugerido",
    isRecurring: true,
    isAnomaly: true,
    sourceData: ["Extrato bancário CSV (linha 23)", "Regra de fornecedor #R-2 (11 aplicações)", "Histórico de pagamentos EDP (média €202/mês)"],
    historicalPattern: { matchCount: 11, lastSeen: "2024-02-05", avgAmount: -202, consistentAccount: true },
    supplierRule: { exists: true, ruleId: "r-2", pattern: "EDP Comercial → 62.2.1" },
  },
  {
    id: "ac-3",
    date: "2024-03-04",
    description: "TRANSF P/ CONSULTORIA PRO SA",
    reference: "TRF-2024030401",
    amount: -3600,
    type: "debito",
    suggestedAccount: "62.2.2",
    suggestedClass: "62 — Fornecimentos e Serviços Externos",
    confidence: 88,
    explanation: "Novo fornecedor identificado. Fatura correspondente localizada no sistema documental — valores e data coincidem. Sugestão baseada na natureza do serviço (consultoria → FSE).",
    detectedEntity: "Consultoria Pro, S.A.",
    detectedEntityType: "fornecedor",
    status: "sugerido",
    linkedDocumentName: "fatura_servicos_consultoria.pdf",
    sourceData: ["Extrato bancário CSV (linha 31)", "Fatura #FT-2024-0089 (match por valor)", "NIF 509 876 543 (primeira ocorrência)"],
    historicalPattern: { matchCount: 1, lastSeen: "2024-03-04", avgAmount: -3600, consistentAccount: true },
    supplierRule: { exists: false },
  },
  {
    id: "ac-4",
    date: "2024-03-02",
    description: "TRANSF DE XYZ SERVICOS LDA",
    reference: "NC-2024-003",
    amount: 320,
    type: "credito",
    suggestedAccount: "62.1.1",
    suggestedClass: "62 — FSE (Nota de Crédito)",
    confidence: 82,
    explanation: "Crédito de fornecedor — corresponde a nota de crédito #NC-2024-003 identificada no sistema. Classificação como redução de FSE por anulação parcial de serviço.",
    detectedEntity: "XYZ Serviços, Lda.",
    detectedEntityType: "fornecedor",
    status: "sugerido",
    linkedDocumentName: "nota_credito_fornecedor_xyz.pdf",
    sourceData: ["Extrato bancário CSV (linha 38)", "Nota de crédito #NC-2024-003", "Histórico fornecedor XYZ (3 transações)"],
    historicalPattern: { matchCount: 3, lastSeen: "2024-02-15", avgAmount: -1800, consistentAccount: true },
    supplierRule: { exists: false },
  },
  {
    id: "ac-5",
    date: "2024-03-01",
    description: "TRANSF P/ IMOBILIARIA CENTRAL",
    reference: "RENDA-MAR24-DUP",
    amount: -1200,
    type: "debito",
    suggestedAccount: "62.2.3",
    suggestedClass: "62 — Fornecimentos e Serviços Externos",
    confidence: 45,
    explanation: "Possível duplicação — mesmo valor (€1.200) e fornecedor (Imobiliária Central) que movimento mv-8 processado 2 dias depois. A regra de fornecedor existe mas a confiança está reduzida pelo risco de duplicação.",
    detectedEntity: "Imobiliária Central",
    detectedEntityType: "fornecedor",
    status: "pendente",
    isDuplicate: true,
    isAnomaly: true,
    sourceData: ["Extrato bancário CSV (linha 42)", "Regra de fornecedor #R-4 (8 aplicações)", "Movimento mv-8 (€1.200, 03/Mar — possível duplicado)"],
    historicalPattern: { matchCount: 8, lastSeen: "2024-03-03", avgAmount: -1200, consistentAccount: true },
    supplierRule: { exists: true, ruleId: "r-4", pattern: "Imobiliária Central → 62.2.3" },
  },
  {
    id: "ac-6",
    date: "2024-02-28",
    description: "PAGAMENTO VODAFONE PT",
    reference: "DD-VOD-FEV24",
    amount: -89.90,
    type: "debito",
    suggestedAccount: "62.2.1",
    suggestedClass: "62 — Fornecimentos e Serviços Externos",
    confidence: 95,
    explanation: "Fornecedor de telecomunicações recorrente. Valor dentro do intervalo habitual (€85–€95). Débito direto mensal consistente.",
    detectedEntity: "Vodafone Portugal",
    detectedEntityType: "fornecedor",
    status: "sugerido",
    isRecurring: true,
    sourceData: ["Extrato bancário CSV (linha 44)", "Regra implícita (6 correspondências)", "Média histórica: €87.50/mês"],
    historicalPattern: { matchCount: 6, lastSeen: "2024-01-28", avgAmount: -87.5, consistentAccount: true },
    supplierRule: { exists: false },
  },
  {
    id: "ac-7",
    date: "2024-02-27",
    description: "TRANSF CARLOS FERREIRA ENI",
    amount: -450,
    type: "debito",
    suggestedAccount: "62.2.2",
    suggestedClass: "62 — Fornecimentos e Serviços Externos",
    confidence: 58,
    explanation: "Entidade identificada como possível prestador de serviços (ENI). Sem fatura correspondente no sistema. Classificação baseada em padrão de descrição.",
    detectedEntity: "Carlos Ferreira, ENI",
    detectedEntityType: "fornecedor",
    status: "sugerido",
    sourceData: ["Extrato bancário CSV (linha 48)", "Registo comercial (ENI detectado)", "Base documental (0 faturas correspondentes)"],
    historicalPattern: { matchCount: 1, lastSeen: "2024-02-27", avgAmount: -450, consistentAccount: false },
    supplierRule: { exists: false },
  },
  {
    id: "ac-8",
    date: "2024-02-26",
    description: "RECEBIMENTO MARTINS & COSTA LDA",
    reference: "TRF-RC0245",
    amount: 7800,
    type: "credito",
    suggestedAccount: "72.1",
    suggestedClass: "72 — Prestações de Serviços",
    confidence: 91,
    explanation: "Cliente identificado. Valor corresponde à fatura #FT-2024-0076 (€7.800). Classificação como rendimento de prestação de serviços.",
    detectedEntity: "Martins & Costa, Lda.",
    detectedEntityType: "cliente",
    status: "sugerido",
    linkedDocumentName: "fatura_martins_costa_ft0076.pdf",
    sourceData: ["Extrato bancário CSV (linha 50)", "Fatura #FT-2024-0076 (match exato)", "Histórico cliente (5 recebimentos)"],
    historicalPattern: { matchCount: 5, lastSeen: "2024-01-15", avgAmount: 6200, consistentAccount: true },
    supplierRule: { exists: false },
  },
];

export const queueSummary = {
  total: 8,
  pending: 2,
  suggested: 6,
  highConfidence: 4,
  mediumConfidence: 2,
  lowConfidence: 2,
  anomalies: 3,
  duplicates: 1,
  withRule: 2,
  withoutRule: 6,
};
