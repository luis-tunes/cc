import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import type { ReactNode } from "react";

const titleEmoji: Record<string, string> = {
  "Painel": "📊",
  "Caixa de Entrada": "📥",
  "Documentos": "📄",
  "Movimentos Bancários": "🏦",
  "Reconciliação": "🔗",
  "Centro Fiscal": "🏛️",
  "Relatórios": "📈",
  "Obrigações Fiscais": "📅",
  "Insights": "💡",
  "Previsões": "🔮",
  "Otimização de Custos": "✂️",
  "Fornecedores": "🤝",
  "Inventário": "📦",
  "Produto Acabado": "🍽️",
  "Lista de Compras": "🛒",
  "Ativos Fixos": "🏗️",
  "Classificações": "🏷️",
  "Auto-Classificação": "🤖",
  "Atividade": "⏱️",
  "Definições": "⚙️",
  "O Meu Perfil": "👤",
  "Perfil da Entidade": "🏢",
  "Administração": "🔒",
  "Monitorização": "📡",
};

interface PageContainerProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageContainerProps) {
  usePageTitle(title);
  const emoji = titleEmoji[title];

  return (
    <div className={cn("flex-1 overflow-auto", className)}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {emoji && <span className="mr-2">{emoji}</span>}
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {/* Page Content */}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
