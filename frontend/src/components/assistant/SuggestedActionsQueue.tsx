import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  suggestedActions,
  categoryConfig,
  priorityConfig,
  type SuggestedAction,
} from "@/lib/assistant-data";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { toast } from "sonner";

export function SuggestedActionsQueue({ className }: { className?: string }) {
  const [items, setItems] = useState(suggestedActions);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAction = (id: string, newStatus: SuggestedAction["status"]) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
    const labels = { aprovado: "Ação aprovada", aplicado: "Aplicada", ignorado: "Ignorada" };
    toast.success(labels[newStatus] || "Atualizado");
  };

  const active = items.filter((i) => i.status === "sugerido");
  const resolved = items.filter((i) => i.status !== "sugerido");

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ações Sugeridas</h3>
        </div>
        <span className="text-xs text-muted-foreground">{active.length} pendentes</span>
      </div>

      <div className="divide-y divide-border">
        {items.map((item) => {
          const cat = categoryConfig[item.category];
          const pri = priorityConfig[item.priority];
          const isExpanded = expandedId === item.id;
          const isResolved = item.status !== "sugerido";

          return (
            <div
              key={item.id}
              className={cn(
                "px-4 py-3 transition-colors",
                isResolved && "opacity-40",
                item.priority === "alta" && !isResolved && "bg-tim-danger/3"
              )}
            >
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", cat.bg, cat.color)}>{cat.label}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", pri.bg, pri.color)}>{pri.label}</span>
                    <ConfidenceIndicator value={item.confidence} size="sm" />
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{item.description}</p>
                </div>

                {/* Actions */}
                {!isResolved && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-tim-success hover:bg-tim-success/10" onClick={() => handleAction(item.id, "aprovado")}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-accent" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-tim-danger/70 hover:bg-tim-danger/10" onClick={() => handleAction(item.id, "ignorado")}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {item.status === "aprovado" && (
                  <span className="rounded bg-tim-success/15 px-2 py-0.5 text-[10px] font-medium text-tim-success shrink-0">Aprovado</span>
                )}
                {item.status === "ignorado" && (
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">Ignorado</span>
                )}
              </div>

              {/* Explainability panel */}
              {isExpanded && (
                <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-2">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-primary/70">Porquê esta sugestão</p>
                    <p className="mt-0.5 text-[11px] text-foreground">{item.reasoning}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-primary/70">Dados fonte</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.sourceData}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => handleAction(item.id, "aprovado")}>Aprovar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]">
                      <Pencil className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground" onClick={() => handleAction(item.id, "ignorado")}>Ignorar</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
