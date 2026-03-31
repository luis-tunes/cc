import { PageContainer } from "@/components/layout/PageContainer";
import { useActivity } from "@/hooks/use-activity";
import { cn } from "@/lib/utils";
import {
  FileText, GitMerge, Tags, Upload, Zap, Activity,
  AlertCircle, Package, Truck, ShoppingCart, Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  uploaded: { label: "Documento enviado", icon: Upload, color: "text-tim-info" },
  auto_classified: { label: "Auto-classificado", icon: Zap, color: "text-primary" },
  run: { label: "Reconciliação executada", icon: GitMerge, color: "text-tim-success" },
  created: { label: "Criado", icon: Tags, color: "text-muted-foreground" },
  updated: { label: "Atualizado", icon: Tags, color: "text-muted-foreground" },
  deleted: { label: "Eliminado", icon: AlertCircle, color: "text-tim-danger" },
};

const ENTITY_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  document: { label: "Documento", icon: FileText },
  reconciliation: { label: "Reconciliação", icon: GitMerge },
  classification_rule: { label: "Regra", icon: Tags },
  ingredient: { label: "Ingrediente", icon: Package },
  supplier: { label: "Fornecedor", icon: Truck },
  stock_event: { label: "Stock", icon: ShoppingCart },
};

function relTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: pt });
  } catch {
    return iso;
  }
}

export default function ActivityFeed() {
  const { data: entries = [], isLoading, isError } = useActivity(100);

  return (
    <PageContainer
      title="Atividade"
      subtitle="Histórico de ações da organização"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <ErrorState title="Erro ao carregar atividade" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Sem atividade registada"
          description="As ações realizadas na plataforma aparecerão aqui (documentos importados, reconciliações, classificações…)"
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="divide-y">
            {entries.map((entry) => {
              const actionCfg = ACTION_CONFIG[entry.action] ?? { label: entry.action, icon: Activity, color: "text-muted-foreground" };
              const entityCfg = ENTITY_CONFIG[entry.entity_type] ?? { label: entry.entity_type, icon: FileText };
              const Icon = actionCfg.icon;
              const EntityIcon = entityCfg.icon;

              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50", actionCfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-sm font-medium">{actionCfg.label}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <EntityIcon className="h-3 w-3" />
                        {entityCfg.label}
                        {entry.entity_id ? ` #${entry.entity_id}` : ""}
                      </span>
                    </div>
                    {entry.detail && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {relTime(entry.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

