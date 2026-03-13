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

// Reconciliations are fetched from the API — no mock data needed.

export const mockPairs: ReconciliationPair[] = [];

export function getReconciliationSummary() {
  return {
    total: 0,
    approved: 0,
    autoMatched: 0,
    suggested: 0,
    exceptions: 0,
    unmatched: 0,
  };
}
