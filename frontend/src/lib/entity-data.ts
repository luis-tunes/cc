export interface EntityData {
  legalName: string;
  nif: string;
  cae: string;
  caeDescription: string;
  entityCategory: string;
  accountingRegime: string;
  vatRegime: string;
  reportingFrequency: string;
  employees: string;
  turnoverRange: string;
  balanceSheetRange: string;
  accountantName: string;
  accountantEmail: string;
  accountantNif: string;
  fiscalRepName: string;
  fiscalRepNif: string;
  address: string;
  postalCode: string;
  city: string;
}

/** Empty defaults — user fills in their own entity data. */
export const defaultEntityData: EntityData = {
  legalName: "",
  nif: "",
  cae: "",
  caeDescription: "",
  entityCategory: "",
  accountingRegime: "",
  vatRegime: "",
  reportingFrequency: "",
  employees: "",
  turnoverRange: "",
  balanceSheetRange: "",
  accountantName: "",
  accountantEmail: "",
  accountantNif: "",
  fiscalRepName: "",
  fiscalRepNif: "",
  address: "",
  postalCode: "",
  city: "",
};

export const entityCategories = [
  { value: "micro", label: "Microentidade", description: "Total balanço ≤ €350k, Volume negócios ≤ €700k, ≤ 10 empregados", regime: "SNC-ME" },
  { value: "pme", label: "Pequena Entidade", description: "Total balanço ≤ €4M, Volume negócios ≤ €8M, ≤ 50 empregados", regime: "SNC-PE" },
  { value: "media", label: "Média Entidade", description: "Total balanço ≤ €20M, Volume negócios ≤ €40M, ≤ 250 empregados", regime: "SNC Geral" },
  { value: "grande", label: "Grande Entidade", description: "Excede 2 dos 3 limites das médias entidades", regime: "SNC Geral + IAS/IFRS" },
];

export const accountingRegimes = [
  { value: "snc-me", label: "SNC — Microentidades", description: "Normativo simplificado para microentidades" },
  { value: "snc-pe", label: "SNC — Pequenas Entidades", description: "NCRF-PE com demonstrações financeiras reduzidas" },
  { value: "snc-geral", label: "SNC — Regime Geral", description: "Plano de contas completo, todas as NCRF aplicáveis" },
  { value: "snc-esnl", label: "SNC — ESNL", description: "Entidades do setor não lucrativo" },
];

export const vatRegimes = [
  { value: "regime-normal-mensal", label: "Regime Normal — Mensal", description: "Volume negócios > €650k ou opção voluntária" },
  { value: "regime-normal-trimestral", label: "Regime Normal — Trimestral", description: "Volume negócios ≤ €650k" },
  { value: "regime-isencao", label: "Regime de Isenção", description: "Art.º 53.º CIVA — Volume negócios ≤ €15k" },
  { value: "regime-pequenos-retalhistas", label: "Regime Especial Pequenos Retalhistas", description: "Retalho — regime simplificado" },
];

export const complianceImpacts = [
  { field: "Categoria", condition: "Microentidade (SNC-ME)", impact: "Demonstrações financeiras simplificadas. IES simplificada. Sem relatório de gestão obrigatório.", type: "info" as const },
  { field: "IVA", condition: "Regime Normal Trimestral", impact: "Declaração periódica trimestral. Prazos: dia 15 do 2.º mês seguinte ao trimestre.", type: "info" as const },
  { field: "IRC", condition: "PME com regime geral", impact: "Modelo 22 anual. 3 pagamentos por conta. IES obrigatória até julho.", type: "info" as const },
  { field: "Representante Fiscal", condition: "Não definido", impact: "Necessário se sede fora de Portugal ou sócio não-residente com obrigações fiscais.", type: "warning" as const },
];

export const setupSteps = [
  { id: 1, title: "Identificação", description: "Dados da entidade e NIF" },
  { id: 2, title: "Enquadramento", description: "Categoria, regime e obrigações" },
  { id: 3, title: "Operação", description: "Dimensão e frequência de reporte" },
  { id: 4, title: "Contabilista", description: "Dados do contabilista certificado" },
];
