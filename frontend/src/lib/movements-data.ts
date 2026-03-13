import { type StatusType } from "@/components/shared/StatusBadge";

export interface BankMovement {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  type: "debito" | "credito";
  suggestedAccount?: string;
  sncClass?: string;
  detectedEntity?: string;
  detectedEntityType?: "fornecedor" | "cliente";
  classificationStatus: StatusType;
  reconciliationStatus: StatusType;
  confidence: number;
  origin: "csv" | "sync" | "manual";
  linkedDocumentId?: string;
  linkedDocumentName?: string;
  aiExplanation?: string;
  isRecurring?: boolean;
  isDuplicate?: boolean;
  isAnomaly?: boolean;
}

/** Empty — populated from the API via useBankTransactions. */
export const bankMovements: BankMovement[] = [];

export const classificationSummary = {
  totalMovements: 0,
  classified: 0,
  pending: 0,
  anomalies: 0,
  duplicates: 0,
  avgConfidence: 0,
  topCategories: [] as { label: string; count: number; percentage: number }[],
};
