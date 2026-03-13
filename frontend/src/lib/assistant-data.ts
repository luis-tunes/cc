export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  category: "fiscal" | "operacional" | "análise" | "comunicação";
}

export interface BiInsight {
  id: string;
  title: string;
  detail: string;
  type: "trend" | "anomaly" | "opportunity" | "risk";
  confidence: number;
}

export interface CommunicationDraft {
  id: string;
  type: "email" | "ofício" | "declaração";
  recipient: string;
  subject: string;
  preview: string;
}

export const categoryLabels: Record<string, string> = {
  fiscal: "Fiscal",
  operacional: "Operacional",
  análise: "Análise",
  comunicação: "Comunicação",
};

export const categoryColors: Record<string, string> = {
  fiscal: "text-primary",
  operacional: "text-tim-info",
  análise: "text-tim-success",
  comunicação: "text-tim-warning",
};

/** Empty — will be powered by AI backend. */
export const quickPrompts: QuickPrompt[] = [];
export const biInsights: BiInsight[] = [];
export const communicationDrafts: CommunicationDraft[] = [];
