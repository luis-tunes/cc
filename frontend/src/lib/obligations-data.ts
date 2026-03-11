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
  readiness: number; // 0–100
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

export const obligationEntries: ObligationEntry[] = [
  {
    id: "ob-1", title: "Segurança Social — Março", category: "ss", deadline: "10 Mar 2024",
    deadlineDate: new Date(2024, 2, 10), daysLeft: 2, status: "pendente", readiness: 60,
    blockers: ["Folha de vencimentos por validar"], nextAction: "Validar folha salarial",
    assignee: "Contabilista", reminderSet: true,
  },
  {
    id: "ob-2", title: "Retenções na Fonte — Março", category: "irc", deadline: "20 Mar 2024",
    deadlineDate: new Date(2024, 2, 20), daysLeft: 12, status: "em-preparação", readiness: 75,
    blockers: [], nextAction: "Verificar cálculos e submeter", linkedDocs: ["Mapa de retenções Mar"],
    assignee: "Contabilista",
  },
  {
    id: "ob-3", title: "Declaração Periódica IVA — T1 2024", category: "iva", deadline: "15 Abr 2024",
    deadlineDate: new Date(2024, 3, 15), daysLeft: 38, status: "em-preparação", readiness: 45,
    blockers: ["3 faturas sem classificação IVA", "12 reconciliações pendentes"],
    nextAction: "Resolver classificações de IVA em falta", linkedDocs: ["Mapa IVA T1", "Extrato bancário Mar"],
    reminderSet: true,
  },
  {
    id: "ob-4", title: "Modelo 22 — IRC 2023", category: "irc", deadline: "31 Mai 2024",
    deadlineDate: new Date(2024, 4, 31), daysLeft: 84, status: "em-preparação", readiness: 30,
    blockers: ["Encerramento de contas 2023 pendente", "Depreciações por calcular"],
    nextAction: "Completar encerramento de exercício 2023",
  },
  {
    id: "ob-5", title: "IES / Declaração Anual 2023", category: "ies", deadline: "15 Jul 2024",
    deadlineDate: new Date(2024, 6, 15), daysLeft: 129, status: "pendente", readiness: 10,
    blockers: ["Modelo 22 por submeter"], nextAction: "Aguardar conclusão do Modelo 22",
  },
  {
    id: "ob-6", title: "Pagamento por Conta IRC — 2ª", category: "irc", deadline: "30 Set 2024",
    deadlineDate: new Date(2024, 8, 30), daysLeft: 205, status: "pendente", readiness: 0,
    blockers: [], nextAction: "Calcular prestação com base no IRC 2023",
  },
  {
    id: "ob-7", title: "Declaração Periódica IVA — T4 2023", category: "iva", deadline: "15 Fev 2024",
    deadlineDate: new Date(2024, 1, 15), daysLeft: -21, status: "concluído", readiness: 100,
    blockers: [], nextAction: "—",
  },
  {
    id: "ob-8", title: "Revisão mensal com contabilista", category: "revisão", deadline: "15 Mar 2024",
    deadlineDate: new Date(2024, 2, 15), daysLeft: 7, status: "pendente", readiness: 40,
    blockers: ["Classificações pendentes", "Reconciliações incompletas"],
    nextAction: "Preparar dossier de revisão", assignee: "Contabilista",
  },
  {
    id: "ob-9", title: "Renovação de certificado digital", category: "negócio", deadline: "01 Abr 2024",
    deadlineDate: new Date(2024, 3, 1), daysLeft: 24, status: "pendente", readiness: 0,
    blockers: [], nextAction: "Iniciar processo de renovação AT",
  },
];

export const alertItems: AlertItem[] = [
  { id: "al-1", obligationId: "ob-1", title: "Segurança Social vence em 2 dias", urgency: "critico", reason: "Folha de vencimentos por validar", daysLeft: 2 },
  { id: "al-2", obligationId: "ob-8", title: "Revisão contabilista em 7 dias", urgency: "urgente", reason: "Classificações e reconciliações pendentes", daysLeft: 7 },
  { id: "al-3", obligationId: "ob-2", title: "Retenções na Fonte em 12 dias", urgency: "aviso", reason: "Em preparação — verificar cálculos", daysLeft: 12 },
  { id: "al-4", obligationId: "ob-3", title: "IVA T1 tem bloqueios por resolver", urgency: "urgente", reason: "3 faturas sem classificação IVA, 12 reconciliações pendentes", daysLeft: 38 },
  { id: "al-5", obligationId: "ob-4", title: "Modelo 22 requer encerramento 2023", urgency: "info", reason: "Depreciações e encerramento de contas pendentes", daysLeft: 84 },
];

export const preparationChecklist = [
  { label: "Resolver classificações IVA em falta", done: false, obligation: "IVA T1" },
  { label: "Completar reconciliações pendentes", done: false, obligation: "IVA T1" },
  { label: "Validar folha de vencimentos Mar", done: false, obligation: "Seg. Social" },
  { label: "Verificar cálculos de retenções", done: true, obligation: "Retenções" },
  { label: "Preparar dossier revisão mensal", done: false, obligation: "Revisão" },
  { label: "Calcular depreciações 2023", done: false, obligation: "Modelo 22" },
];

// Calendar helper: group obligations by month
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
