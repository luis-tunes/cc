import {
  Upload,
  FileText,
  Receipt,
  Image,
  Files,
  Landmark,
  Truck,
  Package,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "documentos" | "financeiro" | "negocio";
  shortcut?: string;
  disabled?: boolean;
  badge?: string;
  uploadPreset?: string;
  navigateTo?: string;
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
  // Negócio
  { id: "fornecedor", label: "Novo fornecedor", icon: Truck, group: "negocio", navigateTo: "/fornecedores" },
  { id: "ingrediente", label: "Novo ingrediente", icon: Package, group: "negocio", navigateTo: "/inventario" },
  { id: "produto", label: "Novo produto", icon: UtensilsCrossed, group: "negocio", navigateTo: "/produtos" },
];

export interface PageContext {
  recommendedIds: string[];
  hint: string;
}

const DEFAULT_CONTEXT: PageContext = {
  recommendedIds: ["upload", "csv"],
  hint: "Ação mais comum: Carregar ficheiro",
};

export const PAGE_CONTEXTS: Record<string, PageContext> = {
  "/painel": {
    recommendedIds: ["upload", "csv"],
    hint: "Está no Painel — carregue um ficheiro ou importe movimentos",
  },
  "/caixa-entrada": {
    recommendedIds: ["upload", "multipla", "imagem"],
    hint: "Receção de documentos — carregue ficheiros rapidamente",
  },
  "/documentos": {
    recommendedIds: ["upload", "multipla", "imagem"],
    hint: "Gestão de documentos — importe ou reveja ficheiros",
  },
  "/movimentos": {
    recommendedIds: ["csv"],
    hint: "Movimentos bancários — importe extratos CSV",
  },
  "/reconciliacao": {
    recommendedIds: ["upload", "csv"],
    hint: "Reconciliação — adicione registos em falta",
  },
};

export function getPageContext(pathname: string): PageContext {
  return PAGE_CONTEXTS[pathname] || DEFAULT_CONTEXT;
}

export const GROUP_LABELS: Record<string, string> = {
  documentos: "Documentos",
  financeiro: "Financeiro",
  negocio: "Negócio",
};
