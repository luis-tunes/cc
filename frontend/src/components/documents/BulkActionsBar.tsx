import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Tags,
  Flag,
  Download,
  Archive,
} from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onApprove: () => void;
  onClassify: () => void;
  onFlag: () => void;
  onExport: () => void;
  onArchive: () => void;
  onClear: () => void;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  onApprove,
  onClassify,
  onFlag,
  onExport,
  onArchive,
  onClear,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-4 py-2",
        "shadow-[0_-2px_15px_-3px_hsl(var(--tim-gold)/0.08)]",
        className
      )}
    >
      <span className="text-xs font-medium text-primary">
        {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
      </span>
      <div className="mx-2 h-4 w-px bg-border" />

      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onApprove}>
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Aprovar
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClassify}>
        <Tags className="mr-1 h-3 w-3" />
        Classificar
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onFlag}>
        <Flag className="mr-1 h-3 w-3" />
        Sinalizar
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onExport}>
        <Download className="mr-1 h-3 w-3" />
        Exportar
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onArchive}>
        <Archive className="mr-1 h-3 w-3" />
        Arquivar
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-7 text-xs text-muted-foreground"
        onClick={onClear}
      >
        Limpar seleção
      </Button>
    </div>
  );
}
