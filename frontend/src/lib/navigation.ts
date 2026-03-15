import {
  LayoutDashboard,
  Inbox,
  FileText,
  Landmark,
  GitMerge,
  Tags,
  Receipt,
  CalendarCheck,
  Package,
  Truck,
  UtensilsCrossed,
  ShoppingCart,
  BarChart3,
  Bot,
  Lightbulb,
  TrendingUp,
  Scissors,
  Building2,
  Plug,
  Settings,
  Lock,
  type LucideIcon,
} from "lucide-react";

export type RouteStatus = "active" | "coming-soon";

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  status: RouteStatus;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Painel", path: "/painel", icon: LayoutDashboard, status: "active" },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Caixa de Entrada", path: "/caixa-entrada", icon: Inbox, status: "active" },
      { title: "Documentos", path: "/documentos", icon: FileText, status: "active" },
      { title: "Movimentos Bancários", path: "/movimentos", icon: Landmark, status: "active" },
      { title: "Reconciliação", path: "/reconciliacao", icon: GitMerge, status: "active" },
      { title: "Inventário", path: "/inventario", icon: Package, status: "active" },
      { title: "Fornecedores", path: "/fornecedores", icon: Truck, status: "active" },
      { title: "Produto Acabado", path: "/produtos", icon: UtensilsCrossed, status: "active" },
      { title: "Lista de Compras", path: "/lista-compras", icon: ShoppingCart, status: "active" },
    ],
  },
  {
    label: "Fiscal & Análise",
    items: [
      { title: "Centro Fiscal", path: "/centro-fiscal", icon: Receipt, status: "active" },
      { title: "Obrigações", path: "/obrigacoes", icon: CalendarCheck, status: "active" },
      { title: "Relatórios", path: "/relatorios", icon: BarChart3, status: "active" },
      { title: "Classificações", path: "/classificacoes", icon: Tags, status: "active" },
      { title: "Insights", path: "/insights", icon: Lightbulb, status: "active" },
      { title: "Previsões", path: "/previsoes", icon: TrendingUp, status: "active" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Perfil da Entidade", path: "/entidade", icon: Building2, status: "active" },
      { title: "Definições", path: "/definicoes", icon: Settings, status: "active" },
    ],
  },
  {
    label: "Brevemente",
    items: [
      { title: "Assistente IA", path: "/assistente", icon: Bot, status: "coming-soon" },
      { title: "Integrações", path: "/integracoes", icon: Plug, status: "coming-soon" },
    ],
  },
];

