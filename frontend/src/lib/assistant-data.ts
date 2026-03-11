export interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  category: "classificação" | "documento" | "ativo" | "obrigação" | "fornecedor" | "reconciliação";
  priority: "alta" | "média" | "baixa";
  confidence: number;
  reasoning: string;
  sourceData: string;
  status: "sugerido" | "aprovado" | "aplicado" | "ignorado";
}

export interface BiInsight {
  id: string;
  title: string;
  metric: string;
  detail: string;
  trend: "up" | "down" | "neutral";
  severity: "info" | "warning" | "danger";
  reasoning: string;
}

export interface DraftMessage {
  id: string;
  type: "lembrete" | "follow-up" | "resumo";
  subject: string;
  recipient: string;
  body: string;
  generatedAt: string;
}

export const quickPrompts = [
  "Qual é o estado das minhas obrigações fiscais?",
  "Resumo dos movimentos não classificados",
  "Quais fornecedores têm gastos acima do normal?",
  "Previsão de tesouraria para os próximos 30 dias",
  "Que documentos precisam de revisão urgente?",
  "Resumo de desempenho do mês",
];

export const suggestedActions: SuggestedAction[] = [
  { id: "sa-1", title: "Classificar 5 movimentos pendentes", description: "Movimentos importados do extrato CSV sem conta SNC atribuída", category: "classificação", priority: "alta", confidence: 88, reasoning: "5 movimentos importados há 3 dias sem classificação. 4 têm sugestão IA com confiança > 80%.", sourceData: "Extrato bancário Mar 2024", status: "sugerido" },
  { id: "sa-2", title: "Rever 3 documentos com baixa confiança", description: "Faturas com extração OCR abaixo de 70% de confiança", category: "documento", priority: "alta", confidence: 65, reasoning: "3 documentos com campos extraídos divergentes dos valores esperados. NIF e montante necessitam validação manual.", sourceData: "Caixa de entrada — últimas 48h", status: "sugerido" },
  { id: "sa-3", title: "Definir depreciação para 2 ativos novos", description: "Ar condicionado e monitores sem regra de amortização", category: "ativo", priority: "média", confidence: 92, reasoning: "Ativos registados há 16 e 52 dias. Sugestão: Eq. Administrativo 8a e Eq. Informático 4a respetivamente.", sourceData: "Registo de Ativos", status: "sugerido" },
  { id: "sa-4", title: "Prazo IVA T1 — resolver bloqueios", description: "Declaração periódica com 3 faturas sem IVA e 12 reconciliações pendentes", category: "obrigação", priority: "alta", confidence: 95, reasoning: "Prazo: 15 Abr 2024 (38 dias). Prontidão atual: 45%. Necessário resolver classificações IVA e reconciliações.", sourceData: "Centro Fiscal + Reconciliação", status: "sugerido" },
  { id: "sa-5", title: "Criar regra para fornecedor recorrente", description: "Consultoria Pro, S.A. com 3 transações sem regra automática", category: "fornecedor", priority: "baixa", confidence: 88, reasoning: "Fornecedor com transações recentes classificadas manualmente como 62.2.2 — FSE Serviços Especializados.", sourceData: "Regras de Classificação", status: "sugerido" },
  { id: "sa-6", title: "Reconciliar 12 movimentos pendentes", description: "Movimentos bancários sem par documental identificado", category: "reconciliação", priority: "média", confidence: 72, reasoning: "12 movimentos sem documento vinculado. 8 têm sugestão de par com confiança > 60%.", sourceData: "Reconciliação", status: "sugerido" },
];

export const biInsights: BiInsight[] = [
  { id: "bi-1", title: "Despesa de utilities atípica", metric: "€890 vs média €202", detail: "EDP Comercial — Março 2024. Montante 340% acima da média mensal.", trend: "up", severity: "warning", reasoning: "Baseado em 11 transações anteriores. Possível fatura de regularização ou erro de faturação." },
  { id: "bi-2", title: "Margem operacional em pressão", metric: "33,5% → 28,1%", detail: "Margem desceu 5,4pp nos últimos 2 meses devido a aumento de FSE.", trend: "down", severity: "warning", reasoning: "FSE subiu 18% vs período homólogo. Principais drivers: subcontratos (+€4.200) e serviços especializados (+€2.800)." },
  { id: "bi-3", title: "Concentração de fornecedor", metric: "32% dos gastos", detail: "ABC Materiais, Lda. representa quase 1/3 dos fornecimentos.", trend: "neutral", severity: "info", reasoning: "14 transações nos últimos 6 meses. Sem alternativas registadas no sistema." },
  { id: "bi-4", title: "Previsão de tesouraria", metric: "€12.400 (30d)", detail: "Saldo projetado para 7 Abril com base em recorrências e obrigações.", trend: "down", severity: "danger", reasoning: "Pagamentos previstos: IVA T1 (€3.840), Seg. Social (€890), fornecedores recorrentes (€6.200). Receitas esperadas: €14.800." },
];

export const draftMessages: DraftMessage[] = [
  { id: "dm-1", type: "lembrete", subject: "Fatura em falta — Mar 2024", recipient: "ABC Materiais, Lda.", body: "Exmo(a) Sr(a),\n\nVimos por este meio solicitar o envio da fatura referente ao serviço prestado em Março de 2024, no valor de €2.450,00.\n\nAgradecemos a atenção dispensada.\n\nCom os melhores cumprimentos,\nEmpresa Demo, Lda.", generatedAt: "2024-03-08 09:15" },
  { id: "dm-2", type: "resumo", subject: "Resumo mensal — Fevereiro 2024", recipient: "Contabilista", body: "Resumo de atividade — Fev 2024:\n\n• 28 movimentos classificados (92% automáticos)\n• 3 documentos pendentes de revisão\n• IVA T4 2023 submetido com sucesso\n• 2 anomalias detetadas e resolvidas\n• Próxima obrigação: Seg. Social — 10 Mar\n\nDossier completo disponível na plataforma.", generatedAt: "2024-03-01 08:00" },
  { id: "dm-3", type: "follow-up", subject: "Seguimento — Nota de crédito #NC-2024-003", recipient: "XYZ Serviços, Lda.", body: "Exmo(a) Sr(a),\n\nRelativamente à nota de crédito #NC-2024-003 no valor de €320,00, confirmamos a receção e registo no nosso sistema.\n\nSolicito confirmação de que o valor será aplicado na próxima fatura.\n\nCom os melhores cumprimentos,\nEmpresa Demo, Lda.", generatedAt: "2024-03-07 14:30" },
];

export const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  classificação: { label: "Classificação", color: "text-primary", bg: "bg-primary/10" },
  documento: { label: "Documento", color: "text-tim-info", bg: "bg-tim-info/10" },
  ativo: { label: "Ativo", color: "text-chart-3", bg: "bg-chart-3/10" },
  obrigação: { label: "Obrigação", color: "text-tim-warning", bg: "bg-tim-warning/10" },
  fornecedor: { label: "Fornecedor", color: "text-foreground", bg: "bg-muted" },
  reconciliação: { label: "Reconciliação", color: "text-tim-success", bg: "bg-tim-success/10" },
};

export const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  alta: { label: "Alta", color: "text-tim-danger", bg: "bg-tim-danger/10" },
  média: { label: "Média", color: "text-tim-warning", bg: "bg-tim-warning/10" },
  baixa: { label: "Baixa", color: "text-muted-foreground", bg: "bg-muted" },
};
