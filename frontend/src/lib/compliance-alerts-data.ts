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

export const complianceAlerts: ComplianceAlert[] = [
  {
    id: "ca-1", priority: "critico", category: "prazo",
    title: "Segurança Social vence em 2 dias",
    detail: "A contribuição mensal de Março está pendente. Folha de vencimentos ainda não validada.",
    daysLeft: 2, obligationRef: "ob-1",
    nextStep: "Validar folha salarial e submeter pagamento",
    nextStepAction: "/obrigacoes",
    blockers: ["Folha de vencimentos por validar"],
    waitingOn: "Contabilista",
    createdAt: "2024-03-08",
  },
  {
    id: "ca-2", priority: "critico", category: "bloqueio",
    title: "IVA T1 — 3 faturas sem classificação IVA",
    detail: "A declaração periódica do IVA T1 2024 não pode ser submetida sem resolver as classificações de IVA em falta.",
    daysLeft: 38, obligationRef: "ob-3",
    nextStep: "Classificar faturas com IVA em falta",
    nextStepAction: "/classificacoes",
    blockers: ["3 faturas sem classificação IVA", "12 reconciliações pendentes"],
    aiGenerated: true,
    createdAt: "2024-03-07",
  },
  {
    id: "ca-3", priority: "urgente", category: "contabilista",
    title: "Revisão mensal aguarda preparação",
    detail: "A reunião de revisão com o contabilista está marcada para 15 Mar. O dossier ainda não está completo.",
    daysLeft: 7, obligationRef: "ob-8",
    nextStep: "Preparar dossier de revisão mensal",
    nextStepAction: "/obrigacoes",
    blockers: ["Classificações pendentes", "Reconciliações incompletas"],
    waitingOn: "Você",
    createdAt: "2024-03-06",
  },
  {
    id: "ca-4", priority: "urgente", category: "dados-em-falta",
    title: "2 fornecedores sem NIF válido",
    detail: "Transações recentes com entidades não validadas fiscalmente. Pode afetar a declaração de IVA.",
    nextStep: "Validar NIF dos fornecedores",
    nextStepAction: "/classificacoes",
    aiGenerated: true,
    createdAt: "2024-03-08",
  },
  {
    id: "ca-5", priority: "urgente", category: "anomalia",
    title: "Despesa EDP 340% acima da média",
    detail: "Fatura de Março: €890 vs média mensal de €202. Possível regularização ou erro.",
    nextStep: "Verificar fatura e reclassificar se necessário",
    nextStepAction: "/movimentos",
    aiGenerated: true,
    createdAt: "2024-03-08",
  },
  {
    id: "ca-6", priority: "atencao", category: "prazo",
    title: "Retenções na Fonte em 12 dias",
    detail: "Em preparação — cálculos por verificar antes da submissão.",
    daysLeft: 12, obligationRef: "ob-2",
    nextStep: "Verificar cálculos de retenções",
    nextStepAction: "/centro-fiscal",
    waitingOn: "Contabilista",
    createdAt: "2024-03-05",
  },
  {
    id: "ca-7", priority: "atencao", category: "preparacao",
    title: "Modelo 22 requer encerramento de 2023",
    detail: "O encerramento do exercício de 2023 está pendente, incluindo cálculo de depreciações.",
    daysLeft: 84, obligationRef: "ob-4",
    nextStep: "Iniciar encerramento de exercício 2023",
    nextStepAction: "/centro-fiscal",
    blockers: ["Encerramento de contas 2023 pendente", "Depreciações por calcular"],
    createdAt: "2024-03-01",
  },
  {
    id: "ca-8", priority: "atencao", category: "dados-em-falta",
    title: "2 ativos sem depreciação definida",
    detail: "Ar condicionado e monitores registados sem regra de amortização.",
    nextStep: "Definir método de depreciação",
    nextStepAction: "/ativos",
    aiGenerated: true,
    createdAt: "2024-03-07",
  },
  {
    id: "ca-9", priority: "info", category: "preparacao",
    title: "Certificado digital expira em 24 dias",
    detail: "O certificado digital da AT precisa de renovação antes de 1 Abril.",
    daysLeft: 24, obligationRef: "ob-9",
    nextStep: "Iniciar processo de renovação no portal AT",
    createdAt: "2024-03-04",
  },
  {
    id: "ca-10", priority: "info", category: "contabilista",
    title: "Possível duplicação de renda",
    detail: "Dois pagamentos de €1.200 à Imobiliária Central em 3 dias.",
    nextStep: "Confirmar com contabilista se é duplicação",
    waitingOn: "Contabilista",
    aiGenerated: true,
    createdAt: "2024-03-08",
  },
];

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
