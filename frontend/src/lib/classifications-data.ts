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

/** Empty — will be populated from the API when classifications backend is built. */
export const entityContext = {
  name: "",
  nif: "",
  cae: "",
  regime: "",
  sector: "",
  profile: "",
};

export const sncClasses: SncClass[] = [];
export const classificationQueue: ClassificationQueueItem[] = [];
export const classificationRules: ClassificationRule[] = [];
export const taxonomyMappings: TaxonomyMapping[] = [];
