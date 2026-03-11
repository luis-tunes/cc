import { cn } from "@/lib/utils";
import { useState } from "react";
import { type AutoClassificationItem } from "@/lib/auto-classification-data";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Pencil,
  AlertTriangle,
  Copy,
  RotateCcw,
  FileText,
  ChevronRight,
  Brain,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface ClassificationWorkflowQueueProps {
  items: AutoClassificationItem[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenDetail: (item: AutoClassificationItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMarkRecurring: (id: string) => void;
  className?: string;
}

export function ClassificationWorkflowQueue({
  items,
  selectedIds,
  activeId,
  onToggleSelect,
  onSelectAll,
  onOpenDetail,
  onApprove,
  onReject,
  onMarkRecurring,
  className,
}: ClassificationWorkflowQueueProps) {
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const fmt = (v: number) => {
    const abs = Math.abs(v);
    return `${v < 0 ? "−" : ""}€${abs.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (item: AutoClassificationItem) => {
    if (item.status === "aprovado") return <span className="rounded bg-tim-success/15 px-2 py-0.5 text-[10px] font-medium text-tim-success">Aprovado</span>;
    if (item.status === "rejeitado") return <span className="rounded bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">Rejeitado</span>;
    if (item.status === "editado") return <span className="rounded bg-tim-info/15 px-2 py-0.5 text-[10px] font-medium text-tim-info">Editado</span>;
    return null;
  };

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onSelectAll}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span className="text-xs font-semibold text-foreground">
          Fila de classificação
        </span>
        <span className="text-[10px] text-muted-foreground">
          {items.filter((i) => i.status === "pendente" || i.status === "sugerido").length} por rever
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {items.map((item) => {
          const isResolved = item.status === "aprovado" || item.status === "rejeitado";
          const isActive = activeId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "group relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer",
                isResolved && "opacity-40",
                isActive && "bg-primary/5 border-l-2 border-l-primary",
                !isActive && "hover:bg-accent/50 border-l-2 border-l-transparent"
              )}
              onClick={() => onOpenDetail(item)}
            >
              {/* Checkbox */}
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => onToggleSelect(item.id)}
                  disabled={isResolved}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Date + flags + amount */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{item.date}</span>
                  {item.isAnomaly && (
                    <span className="flex items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5" /> Anomalia
                    </span>
                  )}
                  {item.isDuplicate && (
                    <span className="flex items-center gap-0.5 rounded bg-tim-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-tim-warning">
                      <Copy className="h-2.5 w-2.5" /> Duplicado?
                    </span>
                  )}
                  {item.isRecurring && (
                    <span className="flex items-center gap-0.5 rounded bg-tim-info/10 px-1.5 py-0.5 text-[9px] font-medium text-tim-info">
                      <RotateCcw className="h-2.5 w-2.5" /> Recorrente
                    </span>
                  )}
                  {item.linkedDocumentName && (
                    <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                      <FileText className="h-2.5 w-2.5" />
                    </span>
                  )}
                  <span className={cn(
                    "ml-auto text-sm font-semibold tabular-nums shrink-0",
                    item.type === "credito" ? "text-tim-success" : "text-foreground"
                  )}>
                    {fmt(item.amount)}
                  </span>
                </div>

                {/* Row 2: Description + entity */}
                <p className="mt-0.5 text-xs font-medium text-foreground truncate">{item.description}</p>
                {item.detectedEntity && (
                  <p className="text-[10px] text-muted-foreground">
                    {item.detectedEntityType === "fornecedor" ? "Fornecedor" : "Cliente"}: {item.detectedEntity}
                  </p>
                )}

                {/* Row 3: AI suggestion inline */}
                <div className="mt-2 flex items-center gap-2">
                  {item.suggestedAccount !== "—" ? (
                    <>
                      <span className="font-mono text-xs font-semibold text-primary">{item.suggestedAccount}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-[10px] text-primary/80 truncate">{item.suggestedClass}</span>
                    </>
                  ) : (
                    <span className="text-[10px] italic text-destructive">Sem sugestão — classificação manual necessária</span>
                  )}
                  <div className="ml-auto shrink-0">
                    <ConfidenceIndicator value={item.confidence} size="sm" />
                  </div>
                </div>

                {/* Row 4: Supplier rule indicator */}
                {item.supplierRule?.exists && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Brain className="h-2.5 w-2.5 text-primary/60" />
                    <span className="text-[9px] text-primary/60">Regra: {item.supplierRule.pattern}</span>
                  </div>
                )}
                {item.historicalPattern && item.historicalPattern.matchCount > 1 && !item.supplierRule?.exists && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Shield className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">
                      {item.historicalPattern.matchCount} ocorrências anteriores · sem regra definida
                    </span>
                  </div>
                )}
              </div>

              {/* Inline actions */}
              {!isResolved && (
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-tim-success hover:bg-tim-success/10" onClick={() => onApprove(item.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-accent" onClick={() => onOpenDetail(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onReject(item.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Status badge */}
              {isResolved && (
                <div className="shrink-0 pt-1">
                  {getStatusBadge(item)}
                </div>
              )}

              {/* Detail chevron */}
              <ChevronRight className={cn(
                "h-4 w-4 shrink-0 mt-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/30"
              )} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
