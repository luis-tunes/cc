// ── Cost Optimization & Gains Data ──

export interface CostCategory {
  id: string;
  sncClass: string;       // e.g. "62"
  sncLabel: string;       // e.g. "Fornecimentos e Serviços Externos"
  subcategories: CostSubcategory[];
  total: number;
  previousTotal: number;  // same period last year
  percentOfRevenue: number;
}

export interface CostSubcategory {
  label: string;
  amount: number;
  previous: number;
  isRecurring: boolean;
  frequency?: string;     // "mensal" | "trimestral" | "anual"
}

export interface SupplierConcentration {
  supplier: string;
  totalSpend: number;
  percentOfCategory: number;
  percentOfTotal: number;
  category: string;
  riskLevel: "alto" | "medio" | "baixo";
  contracts: number;
  trend: "up" | "down" | "stable";
}

export interface MarginIndicator {
  label: string;
  current: number;
  previous: number;
  benchmark: number;
  unit: "%" | "€" | "days";
  direction: "higher-better" | "lower-better";
}

export interface OptimizationRecommendation {
  id: string;
  issue: string;
  reasoning: string;
  estimatedImpact: string;
  annualSaving: number;
  confidence: number;      // 0–100
  category: string;
  priority: "alta" | "media" | "baixa";
  nextAction: string;
  type: "cost" | "revenue" | "efficiency";
}

// ── Mock Data ──

export const costCategories: CostCategory[] = [
  {
    id: "fse",
    sncClass: "62",
    sncLabel: "Fornecimentos e Serviços Externos",
    total: 8_420,
    previousTotal: 7_860,
    percentOfRevenue: 34.3,
    subcategories: [
      { label: "Rendas e alugueres", amount: 2_400, previous: 2_400, isRecurring: true, frequency: "mensal" },
      { label: "Comunicações", amount: 380, previous: 340, isRecurring: true, frequency: "mensal" },
      { label: "Seguros", amount: 620, previous: 580, isRecurring: true, frequency: "mensal" },
      { label: "Serviços contabilidade", amount: 850, previous: 850, isRecurring: true, frequency: "mensal" },
      { label: "Software e licenças", amount: 1_240, previous: 980, isRecurring: true, frequency: "mensal" },
      { label: "Material escritório", amount: 180, previous: 210, isRecurring: false },
      { label: "Deslocações e estadias", amount: 1_450, previous: 1_100, isRecurring: false },
      { label: "Serviços especializados", amount: 1_300, previous: 1_400, isRecurring: false },
    ],
  },
  {
    id: "pessoal",
    sncClass: "63",
    sncLabel: "Gastos com o Pessoal",
    total: 12_800,
    previousTotal: 11_900,
    percentOfRevenue: 52.1,
    subcategories: [
      { label: "Remunerações", amount: 9_200, previous: 8_600, isRecurring: true, frequency: "mensal" },
      { label: "Encargos sociais", amount: 2_180, previous: 2_040, isRecurring: true, frequency: "mensal" },
      { label: "Seguros pessoal", amount: 420, previous: 380, isRecurring: true, frequency: "mensal" },
      { label: "Formação", amount: 600, previous: 480, isRecurring: false },
      { label: "Outros gastos pessoal", amount: 400, previous: 400, isRecurring: true, frequency: "mensal" },
    ],
  },
  {
    id: "depreciacoes",
    sncClass: "64",
    sncLabel: "Gastos de Depreciação e Amortização",
    total: 1_840,
    previousTotal: 1_720,
    percentOfRevenue: 7.5,
    subcategories: [
      { label: "Equipamento informático", amount: 680, previous: 640, isRecurring: true, frequency: "mensal" },
      { label: "Mobiliário", amount: 240, previous: 240, isRecurring: true, frequency: "mensal" },
      { label: "Viaturas", amount: 920, previous: 840, isRecurring: true, frequency: "mensal" },
    ],
  },
  {
    id: "outros",
    sncClass: "68",
    sncLabel: "Outros Gastos e Perdas",
    total: 980,
    previousTotal: 860,
    percentOfRevenue: 4.0,
    subcategories: [
      { label: "Impostos indiretos", amount: 320, previous: 280, isRecurring: true, frequency: "trimestral" },
      { label: "Multas e penalidades", amount: 180, previous: 120, isRecurring: false },
      { label: "Donativos", amount: 200, previous: 200, isRecurring: false },
      { label: "Outros", amount: 280, previous: 260, isRecurring: false },
    ],
  },
];

export const supplierConcentrations: SupplierConcentration[] = [
  { supplier: "Imobiliária Central Lda", totalSpend: 2_400, percentOfCategory: 28.5, percentOfTotal: 9.8, category: "FSE", riskLevel: "alto", contracts: 1, trend: "stable" },
  { supplier: "CloudSoft Solutions", totalSpend: 1_240, percentOfCategory: 14.7, percentOfTotal: 5.1, category: "FSE", riskLevel: "medio", contracts: 3, trend: "up" },
  { supplier: "Gabinete Contabilidade ABC", totalSpend: 850, percentOfCategory: 10.1, percentOfTotal: 3.5, category: "FSE", riskLevel: "medio", contracts: 1, trend: "stable" },
  { supplier: "Seguros Fidelidade", totalSpend: 1_040, percentOfCategory: 12.4, percentOfTotal: 4.3, category: "FSE", riskLevel: "baixo", contracts: 2, trend: "stable" },
  { supplier: "Viagens Abreu", totalSpend: 1_450, percentOfCategory: 17.2, percentOfTotal: 5.9, category: "FSE", riskLevel: "medio", contracts: 0, trend: "up" },
];

export const marginIndicators: MarginIndicator[] = [
  { label: "Margem Bruta", current: 45.8, previous: 48.2, benchmark: 50.0, unit: "%", direction: "higher-better" },
  { label: "Margem Operacional", current: 12.4, previous: 14.1, benchmark: 15.0, unit: "%", direction: "higher-better" },
  { label: "FSE / Receita", current: 34.3, previous: 31.8, benchmark: 28.0, unit: "%", direction: "lower-better" },
  { label: "Pessoal / Receita", current: 52.1, previous: 48.2, benchmark: 45.0, unit: "%", direction: "lower-better" },
  { label: "Prazo Médio Recebimento", current: 42, previous: 38, benchmark: 30, unit: "days", direction: "lower-better" },
  { label: "Prazo Médio Pagamento", current: 35, previous: 32, benchmark: 45, unit: "days", direction: "higher-better" },
];

export const recommendations: OptimizationRecommendation[] = [
  {
    id: "rec1",
    issue: "Software e licenças cresceram 26,5% vs. período anterior",
    reasoning: "Subscrições SaaS aumentaram de €980 para €1.240/mês. Análise identificou 3 ferramentas com sobreposição funcional (gestão de projetos) e 2 licenças não utilizadas há 60+ dias.",
    estimatedImpact: "€3.600–€4.800/ano",
    annualSaving: 4_200,
    confidence: 87,
    category: "FSE",
    priority: "alta",
    nextAction: "Auditar licenças ativas e comparar funcionalidades de PM tools",
    type: "cost",
  },
  {
    id: "rec2",
    issue: "Deslocações e estadias +31,8% sem aumento proporcional de receita",
    reasoning: "Gastos com viagens cresceram significativamente. 68% concentrados num único fornecedor (Viagens Abreu) sem acordo-quadro. Reuniões presenciais em Lisboa representam 45% dos custos.",
    estimatedImpact: "€2.400–€3.600/ano",
    annualSaving: 3_000,
    confidence: 72,
    category: "FSE",
    priority: "media",
    nextAction: "Negociar acordo corporativo e definir política de viagens híbrida",
    type: "cost",
  },
  {
    id: "rec3",
    issue: "Prazo médio de recebimento deteriorou 10,5% (38→42 dias)",
    reasoning: "3 clientes representam 60% dos atrasos. Fatura #1042 (Luso Têxtil) já com 12 dias de atraso. Impacto direto no cash flow — cada dia de atraso médio custa ~€820 em capital imobilizado.",
    estimatedImpact: "€9.800/ano em custo de capital",
    annualSaving: 9_800,
    confidence: 91,
    category: "Tesouraria",
    priority: "alta",
    nextAction: "Implementar política de cobrança automática aos 30 dias",
    type: "efficiency",
  },
  {
    id: "rec4",
    issue: "Concentração de fornecedor em rendas (28,5% do FSE)",
    reasoning: "Dependência total de um único imóvel/senhorio. Sem cláusula de renegociação no contrato atual. Mercado de escritórios no Porto mostra descida de 8% nas rendas prime.",
    estimatedImpact: "€1.920–€2.880/ano",
    annualSaving: 2_400,
    confidence: 58,
    category: "FSE",
    priority: "media",
    nextAction: "Solicitar proposta de renegociação ou avaliar espaço alternativo",
    type: "cost",
  },
  {
    id: "rec5",
    issue: "Margem bruta em pressão descendente (45,8% vs. 48,2%)",
    reasoning: "Custos de pessoal cresceram 7,6% enquanto receita cresceu 3,2%. Rácio pessoal/receita (52,1%) está 7pp acima do benchmark setorial. Produtividade por colaborador caiu 4,1%.",
    estimatedImpact: "Recuperação de 2pp de margem",
    annualSaving: 5_900,
    confidence: 68,
    category: "Pessoal",
    priority: "alta",
    nextAction: "Analisar alocação de horas por projeto e identificar bottlenecks",
    type: "revenue",
  },
  {
    id: "rec6",
    issue: "Multas e penalidades aumentaram 50% (€120→€180)",
    reasoning: "Duas multas por atraso na entrega de IVA e uma penalidade contratual evitável. Padrão recorrente de atrasos no cumprimento de obrigações fiscais no final do trimestre.",
    estimatedImpact: "€720/ano em custos evitáveis",
    annualSaving: 720,
    confidence: 95,
    category: "Conformidade",
    priority: "media",
    nextAction: "Ativar alertas automáticos 15 dias antes de cada obrigação",
    type: "cost",
  },
];

export const costSummary = {
  totalCosts: costCategories.reduce((s, c) => s + c.total, 0),
  previousTotalCosts: costCategories.reduce((s, c) => s + c.previousTotal, 0),
  recurringCosts: costCategories.reduce(
    (s, c) => s + c.subcategories.filter((sc) => sc.isRecurring).reduce((ss, sc) => ss + sc.amount, 0),
    0
  ),
  totalPotentialSavings: recommendations.reduce((s, r) => s + r.annualSaving, 0),
  highConfidenceRecs: recommendations.filter((r) => r.confidence >= 80).length,
  revenue: 24_580,
};
