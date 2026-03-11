import {
  Upload,
  FileText,
  Receipt,
  Image,
  Files,
  Landmark,
  Package,
  CalendarCheck,
  Users,
  UserPlus,
  Brain,
  ScanSearch,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "documentos" | "financeiro" | "estrutura" | "ai";
  shortcut?: string;
  disabled?: boolean;
  badge?: string;
  uploadPreset?: string;
}

export const ALL_ACTIONS: QuickAction[] = [
  // Documentos
  { id: "upload", label: "Carregar ficheiro", icon: Upload, group: "documentos", shortcut: "U", uploadPreset: undefined },
  { id: "fatura", label: "Carregar fatura", icon: FileText, group: "documentos", uploadPreset: "fatura" },
  { id: "recibo", label: "Carregar recibo", icon: Receipt, group: "documentos", uploadPreset: "recibo" },
  { id: "imagem", label: "Importar imagem", icon: Image, group: "documentos", uploadPreset: "imagem" },
  { id: "multipla", label: "Importação múltipla", icon: Files, group: "documentos", uploadPreset: undefined },
  // Financeiro
  { id: "csv", label: "Importar CSV bancário", icon: Landmark, group: "financeiro", uploadPreset: undefined },
  { id: "movimento", label: "Adicionar movimento", icon: Landmark, group: "financeiro", disabled: true, badge: "Brevemente" },
  // Estrutura
  { id: "ativo", label: "Adicionar ativo", icon: Package, group: "estrutura" },
  { id: "obrigacao", label: "Criar obrigação", icon: CalendarCheck, group: "estrutura" },
  { id: "fornecedor", label: "Adicionar fornecedor", icon: Users, group: "estrutura" },
  { id: "cliente", label: "Adicionar cliente", icon: UserPlus, group: "estrutura" },
  // AI
  { id: "classificacao-auto", label: "Classificação automática", icon: Brain, group: "ai" },
  { id: "revisao", label: "Revisão assistida", icon: ScanSearch, group: "ai" },
  { id: "resumo-ai", label: "Gerar resumo com IA", icon: Sparkles, group: "ai" },
];

export interface PageContext {
  recommendedIds: string[];
  hint: string;
}

const DEFAULT_CONTEXT: PageContext = {
  recommendedIds: ["upload", "csv", "classificacao-auto"],
  hint: "Ação mais comum: Carregar ficheiro",
};

export const PAGE_CONTEXTS: Record<string, PageContext> = {
  "/painel": {
    recommendedIds: ["upload", "csv", "classificacao-auto", "obrigacao"],
    hint: "Está no Painel — ação mais comum: Carregar ficheiro",
  },
  "/caixa-entrada": {
    recommendedIds: ["upload", "multipla", "imagem", "revisao"],
    hint: "Receção de documentos — carregue ficheiros rapidamente",
  },
  "/documentos": {
    recommendedIds: ["upload", "multipla", "imagem", "revisao"],
    hint: "Gestão de documentos — importe ou reveja ficheiros",
  },
  "/movimentos": {
    recommendedIds: ["csv", "classificacao-auto", "movimento"],
    hint: "Movimentos bancários — importe extratos CSV",
  },
  "/reconciliacao": {
    recommendedIds: ["upload", "csv", "revisao"],
    hint: "Reconciliação — adicione registos em falta",
  },
  "/centro-fiscal": {
    recommendedIds: ["obrigacao", "resumo-ai", "upload"],
    hint: "Centro fiscal — crie obrigações ou gere resumos",
  },
  "/classificacoes": {
    recommendedIds: ["classificacao-auto", "fornecedor", "cliente"],
    hint: "Classificações — automatize ou configure entidades",
  },
  "/obrigacoes": {
    recommendedIds: ["obrigacao", "resumo-ai"],
    hint: "Obrigações — crie ou acompanhe prazos",
  },
  "/ativos": {
    recommendedIds: ["ativo", "upload"],
    hint: "Ativos — registe ou documente ativos",
  },
  "/assistente": {
    recommendedIds: ["classificacao-auto", "resumo-ai", "revisao"],
    hint: "Assistente IA — inicie tarefas assistidas",
  },
};

export function getPageContext(pathname: string): PageContext {
  return PAGE_CONTEXTS[pathname] || DEFAULT_CONTEXT;
}

export const GROUP_LABELS: Record<string, string> = {
  documentos: "Documentos",
  financeiro: "Financeiro",
  estrutura: "Compliance / Estrutura",
  ai: "AI / Assistido",
};
