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
  Settings,
  Lock,
  Brain,
  Activity,
  BookOpen,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type RouteStatus = "active" | "coming-soon";

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  status: RouteStatus;
  /** Requires paid plan — locked during free trial */
  proOnly?: boolean;
  /** Only visible to master/admin users */
  masterOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Painel", path: "/painel", icon: LayoutDashboard, status: "active" },
      { title: "Caixa de Entrada", path: "/caixa-entrada", icon: Inbox, status: "active" },
      { title: "Documentos", path: "/documentos", icon: FileText, status: "active" },
      { title: "Movimentos", path: "/movimentos", icon: Landmark, status: "active" },
      { title: "Reconciliação", path: "/reconciliacao", icon: GitMerge, status: "active", proOnly: true },
      { title: "Auto-Classificação", path: "/auto-classificacao", icon: Brain, status: "active", proOnly: true },
      { title: "Classificações", path: "/classificacoes", icon: Tags, status: "active" },
      { title: "Assistente IA", path: "/assistente", icon: Bot, status: "active", proOnly: true },
      { title: "Atividade", path: "/atividade", icon: Activity, status: "active", proOnly: true },
    ],
  },
  {
    label: "Negócio",
    items: [
      { title: "Inventário", path: "/inventario", icon: Package, status: "active", proOnly: true },
      { title: "Fornecedores", path: "/fornecedores", icon: Truck, status: "active", proOnly: true },
      { title: "Produtos", path: "/produtos", icon: UtensilsCrossed, status: "active", proOnly: true },
      { title: "Lista de Compras", path: "/lista-compras", icon: ShoppingCart, status: "active", proOnly: true },
      { title: "Ativos", path: "/ativos", icon: Lock, status: "active", proOnly: true },
      { title: "Obrigações", path: "/obrigacoes", icon: CalendarCheck, status: "active", proOnly: true },
      { title: "Centro Fiscal", path: "/centro-fiscal", icon: Receipt, status: "active", proOnly: true },
      { title: "Relatórios", path: "/relatorios", icon: BarChart3, status: "active", proOnly: true },
      { title: "Insights", path: "/insights", icon: Lightbulb, status: "active", proOnly: true },
      { title: "Previsões", path: "/previsoes", icon: TrendingUp, status: "active", proOnly: true },
      { title: "Otimização de Custos", path: "/otimizacao", icon: Scissors, status: "active", proOnly: true },
    ],
  },
  {
    label: "Definições",
    items: [
      { title: "Entidade", path: "/entidade", icon: Building2, status: "active" },
      { title: "Guia", path: "/guia", icon: BookOpen, status: "active" },
      { title: "Definições", path: "/definicoes", icon: Settings, status: "active" },
      { title: "Admin", path: "/admin", icon: Shield, status: "active", proOnly: true, masterOnly: true },
    ],
  },
];

