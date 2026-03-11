import { type StatusType } from "@/components/shared/StatusBadge";

export type MatchStatus = "auto-matched" | "suggested" | "exception" | "unmatched" | "approved";

export interface ReconciliationPair {
  id: string;
  status: MatchStatus;
  confidence: number;
  reasoning: string;
  amountDelta: number;
  dateDelta: number; // days
  document?: {
    id: string;
    fileName: string;
    supplier?: string;
    customer?: string;
    amount: number;
    vat: number;
    date: string;
    type: string;
    extractionConfidence: number;
  };
  movement?: {
    id: string;
    description: string;
    amount: number;
    date: string;
    reference?: string;
    classification?: string;
    sncClass?: string;
  };
  exceptions?: string[];
}

export const mockPairs: ReconciliationPair[] = [
  {
    id: "rec-1",
    status: "approved",
    confidence: 98,
    reasoning: "Montante e fornecedor coincidem. Diferença de 1 dia entre data do documento e do movimento.",
    amountDelta: 0,
    dateDelta: 1,
    document: {
      id: "doc-1",
      fileName: "fatura_abc_materiais_0847.pdf",
      supplier: "ABC Materiais, Lda.",
      amount: 2450.0,
      vat: 563.5,
      date: "2024-03-05",
      type: "Fatura",
      extractionConfidence: 96,
    },
    movement: {
      id: "mv-1",
      description: "TRANSF P/ ABC MATERIAIS LDA",
      amount: -2450.0,
      date: "2024-03-08",
      reference: "TRF-2024030801",
      classification: "62.1.1",
      sncClass: "62 — FSE",
    },
  },
  {
    id: "rec-2",
    status: "auto-matched",
    confidence: 95,
    reasoning: "Cliente e montante coincidem. Documento e movimento no mesmo dia.",
    amountDelta: 0,
    dateDelta: 0,
    document: {
      id: "doc-2",
      fileName: "recibo_cliente_silva_rc0231.pdf",
      customer: "Silva & Filhos, S.A.",
      amount: 5200.0,
      vat: 1196.0,
      date: "2024-03-07",
      type: "Recibo",
      extractionConfidence: 92,
    },
    movement: {
      id: "mv-2",
      description: "TRANSF DE SILVA E FILHOS SA",
      amount: 5200.0,
      date: "2024-03-07",
      reference: "TRF-2024030701",
      classification: "72.1",
      sncClass: "72 — Prestações de Serviços",
    },
  },
  {
    id: "rec-3",
    status: "suggested",
    confidence: 72,
    reasoning: "Fornecedor identificado (EDP). Montante coincide mas extração do IVA com baixa confiança. Data com 6 dias de diferença.",
    amountDelta: 0,
    dateDelta: 6,
    document: {
      id: "doc-3",
      fileName: "fatura_utilities_edp_mar24.pdf",
      supplier: "EDP Comercial",
      amount: 890.0,
      vat: 204.7,
      date: "2024-03-01",
      type: "Fatura",
      extractionConfidence: 68,
    },
    movement: {
      id: "mv-3",
      description: "PAGAMENTO EDP COMERCIAL",
      amount: -890.0,
      date: "2024-03-07",
      reference: "DD-EDP-MAR24",
      classification: "62.2.1",
      sncClass: "62 — FSE",
    },
    exceptions: ["Extração com baixa confiança (68%)", "Diferença de 6 dias entre datas"],
  },
  {
    id: "rec-4",
    status: "exception",
    confidence: 45,
    reasoning: "Possível duplicação: mesmo fornecedor e valor que rec-7. Datas próximas (1 Mar vs 3 Mar). Requer verificação manual.",
    amountDelta: 0,
    dateDelta: 2,
    document: {
      id: "doc-7",
      fileName: "recibo_renda_escritorio.pdf",
      supplier: "Imobiliária Central",
      amount: 1200.0,
      vat: 0,
      date: "2024-03-01",
      type: "Recibo",
      extractionConfidence: 91,
    },
    movement: {
      id: "mv-10",
      description: "TRANSF P/ IMOBILIARIA CENTRAL",
      amount: -1200.0,
      date: "2024-03-01",
      reference: "RENDA-MAR24-DUP",
      classification: "62.2.3",
      sncClass: "62 — FSE",
    },
    exceptions: [
      "Possível duplicação com outra transação",
      "Dois movimentos com mesmo valor e fornecedor no mesmo período",
    ],
  },
  {
    id: "rec-5",
    status: "exception",
    confidence: 34,
    reasoning: "Documento com extração muito baixa. Sem fornecedor identificado. Sem correspondência clara.",
    amountDelta: 0,
    dateDelta: 0,
    document: {
      id: "doc-4",
      fileName: "scan_despesa_0044.jpg",
      amount: 47.5,
      vat: 0,
      date: "2024-03-04",
      type: "Outro",
      extractionConfidence: 34,
    },
    exceptions: [
      "Extração com confiança muito baixa (34%)",
      "Sem fornecedor identificado",
      "Sem movimento bancário correspondente",
    ],
  },
  {
    id: "rec-6",
    status: "unmatched",
    confidence: 0,
    reasoning: "",
    amountDelta: 0,
    dateDelta: 0,
    movement: {
      id: "mv-5",
      description: "DEPOSITO NUMERARIO",
      amount: 1000.0,
      date: "2024-03-05",
    },
  },
  {
    id: "rec-7",
    status: "auto-matched",
    confidence: 91,
    reasoning: "Fornecedor e montante coincidem. Diferença de 2 dias.",
    amountDelta: 0,
    dateDelta: 2,
    document: {
      id: "doc-7b",
      fileName: "recibo_renda_escritorio.pdf",
      supplier: "Imobiliária Central",
      amount: 1200.0,
      vat: 0,
      date: "2024-03-01",
      type: "Recibo",
      extractionConfidence: 91,
    },
    movement: {
      id: "mv-8",
      description: "TRANSF P/ IMOBILIARIA CENTRAL",
      amount: -1200.0,
      date: "2024-03-03",
      reference: "RENDA-MAR24",
      classification: "62.2.3",
      sncClass: "62 — FSE",
    },
  },
];

export function getReconciliationSummary() {
  const pairs = mockPairs;
  return {
    total: pairs.length,
    approved: pairs.filter((p) => p.status === "approved").length,
    autoMatched: pairs.filter((p) => p.status === "auto-matched").length,
    suggested: pairs.filter((p) => p.status === "suggested").length,
    exceptions: pairs.filter((p) => p.status === "exception").length,
    unmatched: pairs.filter((p) => p.status === "unmatched").length,
  };
}
