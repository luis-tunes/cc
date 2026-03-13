export type AlertPriority = "critico" | "urgente" | "atencao" | "info";
export type AlertCategory = "prazo" | "bloqueio" | "dados-em-falta" | "contabilista" | "anomalia" | "preparacao";

export interface ComplianceAlert {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  detail: string;
  daysLeft?: number;
  obligationRef?: string;
  nextStep: string;
  nextStepAction?: string; // route to navigate
  blockers?: string[];
  waitingOn?: string; // accountant / client / system
  aiGenerated?: boolean;
  read?: boolean;
  createdAt: string;
}

export const priorityConfig: Record<AlertPriority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critico: { label: "Crítico", color: "text-tim-danger", bg: "bg-tim-danger/10", border: "border-tim-danger/30", dot: "bg-tim-danger" },
  urgente: { label: "Urgente", color: "text-tim-warning", bg: "bg-tim-warning/10", border: "border-tim-warning/30", dot: "bg-tim-warning" },
  atencao: { label: "Atenção", color: "text-tim-info", bg: "bg-tim-info/10", border: "border-tim-info/30", dot: "bg-tim-info" },
  info: { label: "Info", color: "text-muted-foreground", bg: "bg-muted", border: "border-border", dot: "bg-muted-foreground" },
};

export const categoryConfig: Record<AlertCategory, { label: string; icon: string }> = {
  prazo: { label: "Prazo", icon: "calendar-clock" },
  bloqueio: { label: "Bloqueio", icon: "lock" },
  "dados-em-falta": { label: "Dados em falta", icon: "file-question" },
  contabilista: { label: "Contabilista", icon: "user-check" },
  anomalia: { label: "Anomalia", icon: "alert-triangle" },
  preparacao: { label: "Preparação", icon: "list-checks" },
};

/** Empty — compliance alerts will come from the API. */
export const complianceAlerts: ComplianceAlert[] = [];

export function getAlertsByPriority(alerts: ComplianceAlert[]): Record<AlertPriority, ComplianceAlert[]> {
  return {
    critico: alerts.filter((a) => a.priority === "critico"),
    urgente: alerts.filter((a) => a.priority === "urgente"),
    atencao: alerts.filter((a) => a.priority === "atencao"),
    info: alerts.filter((a) => a.priority === "info"),
  };
}

export function getUnreadCount(alerts: ComplianceAlert[]): number {
  return alerts.filter((a) => !a.read).length;
}

export function getCriticalCount(alerts: ComplianceAlert[]): number {
  return alerts.filter((a) => a.priority === "critico" || a.priority === "urgente").length;
}
