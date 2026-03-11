import {
  LayoutDashboard,
  Activity,
  Inbox,
  FileText,
  Landmark,
  GitMerge,
  Tags,
  Receipt,
  CalendarCheck,
  Package,
  BarChart3,
  Bot,
  Lightbulb,
  TrendingUp,
  Scissors,
  Building2,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Painel", path: "/painel", icon: LayoutDashboard },
      { title: "Atividade", path: "/atividade", icon: Activity },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Caixa de Entrada", path: "/caixa-entrada", icon: Inbox },
      { title: "Documentos", path: "/documentos", icon: FileText },
      { title: "Movimentos Bancários", path: "/movimentos", icon: Landmark },
      { title: "Reconciliação", path: "/reconciliacao", icon: GitMerge },
    ],
  },
  {
    label: "Conformidade",
    items: [
      { title: "Classificações", path: "/classificacoes", icon: Tags },
      { title: "Centro Fiscal", path: "/centro-fiscal", icon: Receipt },
      { title: "Obrigações", path: "/obrigacoes", icon: CalendarCheck },
      { title: "Ativos", path: "/ativos", icon: Package },
      { title: "Relatórios", path: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { title: "Assistente IA", path: "/assistente", icon: Bot },
      { title: "Insights", path: "/insights", icon: Lightbulb },
      { title: "Previsões", path: "/previsoes", icon: TrendingUp },
      { title: "Otimização", path: "/otimizacao", icon: Scissors },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Perfil da Entidade", path: "/entidade", icon: Building2 },
      { title: "Integrações", path: "/integracoes", icon: Plug },
      { title: "Definições", path: "/definicoes", icon: Settings },
    ],
  },
];
