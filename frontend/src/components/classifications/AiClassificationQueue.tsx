import { cn } from "@/lib/utils";
import { useState } from "react";
import { classificationQueue, type ClassificationQueueItem } from "@/lib/classifications-data";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function AiClassificationQueue({ className }: { className?: string }) {
  const [items, setItems] = useState(classificationQueue);

  const handleAction = (id: string, action: "aprovado" | "rejeitado") => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: action } : i)));
    toast.success(action === "aprovado" ? "Classificação aprovada" : "Classificação rejeitada");
  };

  const pending = items.filter((i) => i.status === "pendente" || i.status === "sugerido");
  const resolved = items.filter((i) => i.status === "aprovado" || i.status === "rejeitado");

  const fmt = (v: number) => {
    const abs = Math.abs(v);
    return `${v < 0 ? "−" : ""}€${abs.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Fila de Classificação IA</h3>
        </div>
        <span className="text-xs text-muted-foreground">{pending.length} por rever</span>
      </div>

      <div className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "px-4 py-3 transition-colors",
              item.status === "aprovado" && "opacity-50",
              item.status === "rejeitado" && "opacity-30",
              item.confidence < 50 && item.status !== "aprovado" && item.status !== "rejeitado" && "bg-tim-danger/5"
            )}
          >
            {/* Row 1: Movement info */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{item.date}</span>
                  {item.confidence < 50 && <AlertTriangle className="h-3 w-3 text-tim-danger" />}
                </div>
                <p className="mt-0.5 text-xs font-medium text-foreground truncate">{item.description}</p>
                {item.detectedEntity && (
                  <p className="text-[10px] text-muted-foreground">{item.detectedEntity}</p>
                )}
              </div>
              <span className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                item.type === "credito" ? "text-tim-success" : "text-foreground"
              )}>
                {fmt(item.amount)}
              </span>
            </div>

            {/* Row 2: AI suggestion */}
            <div className="mt-2 flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-primary/70">Sugestão IA</span>
                  <ConfidenceIndicator value={item.confidence} size="sm" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {item.suggestedAccount !== "—" ? (
                    <>
                      <span className="font-mono text-xs font-semibold text-primary">{item.suggestedAccount}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-[10px] italic text-primary/80">{item.suggestedClass}</span>
                    </>
                  ) : (
                    <span className="text-[10px] italic text-tim-danger">Sem sugestão disponível</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{item.explanation}</p>
              </div>

              {/* Actions */}
              {(item.status === "pendente" || item.status === "sugerido") && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-tim-success hover:bg-tim-success/10" onClick={() => handleAction(item.id, "aprovado")}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-tim-danger hover:bg-tim-danger/10" onClick={() => handleAction(item.id, "rejeitado")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {item.status === "aprovado" && (
                <span className="rounded bg-tim-success/15 px-2 py-0.5 text-[10px] font-medium text-tim-success">Aprovado</span>
              )}
              {item.status === "rejeitado" && (
                <span className="rounded bg-tim-danger/15 px-2 py-0.5 text-[10px] font-medium text-tim-danger">Rejeitado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
