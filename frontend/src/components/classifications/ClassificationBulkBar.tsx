import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, X, RotateCcw, Plus, Brain } from "lucide-react";

interface ClassificationBulkBarProps {
  selectedCount: number;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onMarkRecurring: () => void;
  onCreateRules: () => void;
  onClear: () => void;
  className?: string;
}

export function ClassificationBulkBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onMarkRecurring,
  onCreateRules,
  onClear,
  className,
}: ClassificationBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5",
        "shadow-[0_-2px_15px_-3px_hsl(var(--primary)/0.1)]",
        "animate-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      <span className="text-xs font-semibold text-primary tabular-nums">
        {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
      </span>
      <div className="mx-2 h-4 w-px bg-border" />

      <Button
        size="sm"
        className="h-7 text-xs bg-tim-success hover:bg-tim-success/90 text-tim-success-foreground"
        onClick={onApproveAll}
      >
        <Check className="mr-1 h-3 w-3" /> Aprovar todos
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={onRejectAll}>
        <X className="mr-1 h-3 w-3" /> Rejeitar
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onMarkRecurring}>
        <RotateCcw className="mr-1 h-3 w-3" /> Recorrente
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCreateRules}>
        <Brain className="mr-1 h-3 w-3" /> Criar regras
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-7 text-xs text-muted-foreground"
        onClick={onClear}
      >
        Limpar
      </Button>
    </div>
  );
}
