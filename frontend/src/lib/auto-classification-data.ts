import { type StatusType } from "@/components/shared/StatusBadge";

export interface AutoClassificationItem {
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
  status: StatusType;
  rules?: string[];
  alternatives?: { account: string; label: string; confidence: number }[];
}

/** Empty — will be populated from the API. */
export const autoClassificationQueue: AutoClassificationItem[] = [];
export const autoClassificationSummary = {
  total: 0,
  approved: 0,
  rejected: 0,
  pending: 0,
  avgConfidence: 0,
};
