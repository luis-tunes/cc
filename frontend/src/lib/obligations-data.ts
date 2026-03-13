export type ObligationCategory = "iva" | "irc" | "ies" | "ss" | "negócio" | "revisão";
export type ObligationStatus = "concluído" | "pronto" | "em-preparação" | "pendente" | "atrasado" | "bloqueado";

export interface ObligationEntry {
  id: string;
  title: string;
  category: ObligationCategory;
  deadline: string;
  deadlineDate: Date;
  daysLeft: number;
  status: ObligationStatus;
  readiness: number;
  blockers: string[];
  linkedDocs?: string[];
  nextAction: string;
  description?: string;
  assignee?: string;
  reminderSet?: boolean;
}

export interface AlertItem {
  id: string;
  obligationId: string;
  title: string;
  urgency: "critico" | "urgente" | "aviso" | "info";
  reason: string;
  daysLeft: number;
}

export const categoryConfig: Record<ObligationCategory, { label: string; color: string; bgColor: string }> = {
  iva: { label: "IVA", color: "text-primary", bgColor: "bg-primary/15" },
  irc: { label: "IRC", color: "text-tim-info", bgColor: "bg-tim-info/15" },
  ies: { label: "IES", color: "text-chart-3", bgColor: "bg-chart-3/15" },
  ss: { label: "Seg. Social", color: "text-tim-warning", bgColor: "bg-tim-warning/15" },
  negócio: { label: "Negócio", color: "text-foreground", bgColor: "bg-muted" },
  revisão: { label: "Revisão", color: "text-tim-success", bgColor: "bg-tim-success/15" },
};

export const statusConfig: Record<ObligationStatus, { label: string; color: string; bgColor: string }> = {
  concluído: { label: "Concluído", color: "text-tim-success", bgColor: "bg-tim-success/10" },
  pronto: { label: "Pronto", color: "text-primary", bgColor: "bg-primary/10" },
  "em-preparação": { label: "Em preparação", color: "text-tim-info", bgColor: "bg-tim-info/10" },
  pendente: { label: "Pendente", color: "text-muted-foreground", bgColor: "bg-muted" },
  atrasado: { label: "Atrasado", color: "text-tim-danger", bgColor: "bg-tim-danger/10" },
  bloqueado: { label: "Bloqueado", color: "text-tim-danger", bgColor: "bg-tim-danger/10" },
};

/** Empty — will be populated from the API. */
export const obligationEntries: ObligationEntry[] = [];
export const alertItems: AlertItem[] = [];
export const preparationChecklist: { label: string; done: boolean; obligation: string }[] = [];

export function getObligationsByMonth(entries: ObligationEntry[]): Record<string, ObligationEntry[]> {
  const grouped: Record<string, ObligationEntry[]> = {};
  entries.forEach((e) => {
    const key = `${e.deadlineDate.getFullYear()}-${String(e.deadlineDate.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  return grouped;
}

export const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
