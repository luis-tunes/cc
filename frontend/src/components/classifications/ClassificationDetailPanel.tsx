import { cn } from "@/lib/utils";
import { type AutoClassificationItem } from "@/lib/auto-classification-data";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Check,
  X,
  Pencil,
  RotateCcw,
  Brain,
  FileText,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
  BookOpen,
  History,
  Shield,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface ClassificationDetailPanelProps {
  item: AutoClassificationItem | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, account: string, cls: string) => void;
  onCreateRule: (id: string) => void;
  onMarkRecurring: (id: string) => void;
  className?: string;
}

export function ClassificationDetailPanel({
  item,
  onApprove,
  onReject,
  onEdit,
  onCreateRule,
  onMarkRecurring,
  className,
}: ClassificationDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAccount, setEditAccount] = useState("");
  const [editClass, setEditClass] = useState("");
  const [showSources, setShowSources] = useState(true);

  if (!item) {
    return (
      <div className={cn("rounded-lg border bg-card flex items-center justify-center", className)}>
        <div className="text-center px-6 py-16">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">Selecione um movimento para ver os detalhes da classificação</p>
        </div>
      </div>
    );
  }

  const fmt = (v: number) => {
    const abs = Math.abs(v);
    return `${v < 0 ? "−" : ""}€${abs.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`;
  };

  const isResolved = item.status === "aprovado" || item.status === "rejeitado";

  const startEdit = () => {
    setEditAccount(item.suggestedAccount === "—" ? "" : item.suggestedAccount);
    setEditClass(item.suggestedClass === "—" ? "" : item.suggestedClass);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editAccount.trim()) {
      onEdit(item.id, editAccount, editClass);
      setIsEditing(false);
    }
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">{item.date}</span>
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            item.type === "credito" ? "text-tim-success" : "text-foreground"
          )}>
            {fmt(item.amount)}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">{item.description}</p>
        {item.reference && <p className="text-[10px] text-muted-foreground">Ref: {item.reference}</p>}
        {item.detectedEntity && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {item.detectedEntityType === "fornecedor" ? "Fornecedor" : "Cliente"}
            </span>
            <span className="text-xs text-foreground">{item.detectedEntity}</span>
          </div>
        )}

        {/* Flags */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.isAnomaly && (
            <span className="flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> Anomalia detetada
            </span>
          )}
          {item.isDuplicate && (
            <span className="flex items-center gap-1 rounded bg-tim-warning/10 px-2 py-0.5 text-[10px] font-medium text-tim-warning">
              <Copy className="h-2.5 w-2.5" /> Possível duplicado
            </span>
          )}
          {item.isRecurring && (
            <span className="flex items-center gap-1 rounded bg-tim-info/10 px-2 py-0.5 text-[10px] font-medium text-tim-info">
              <RotateCcw className="h-2.5 w-2.5" /> Recorrente
            </span>
          )}
          {item.linkedDocumentName && (
            <span className="flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground">
              <FileText className="h-2.5 w-2.5" /> {item.linkedDocumentName}
            </span>
          )}
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Sugestão IA</span>
          <div className="ml-auto">
            <ConfidenceIndicator value={item.confidence} size="md" />
          </div>
        </div>

        {!isEditing ? (
          <div className="rounded-md bg-muted/50 px-3 py-2.5">
            {item.suggestedAccount !== "—" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">{item.suggestedAccount}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs text-foreground">{item.suggestedClass}</span>
                </div>
              </>
            ) : (
              <p className="text-xs italic text-destructive">Sem sugestão disponível — classificação manual necessária</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2.5">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Conta SNC</label>
              <Input
                value={editAccount}
                onChange={(e) => setEditAccount(e.target.value)}
                className="h-8 mt-1 font-mono text-sm"
                placeholder="62.2.1"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Classe</label>
              <Input
                value={editClass}
                onChange={(e) => setEditClass(e.target.value)}
                className="h-8 mt-1 text-xs"
                placeholder="62 — FSE"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={saveEdit}>
                <Save className="mr-1 h-3 w-3" /> Guardar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reasoning */}
      <div className="border-b px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Porquê esta sugestão</p>
        <p className="text-xs leading-relaxed text-foreground/80">{item.explanation}</p>
      </div>

      {/* Historical pattern */}
      {item.historicalPattern && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Padrão histórico</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-muted/50 px-2.5 py-1.5">
              <p className="text-[9px] text-muted-foreground">Ocorrências</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{item.historicalPattern.matchCount}</p>
            </div>
            <div className="rounded bg-muted/50 px-2.5 py-1.5">
              <p className="text-[9px] text-muted-foreground">Última vez</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{item.historicalPattern.lastSeen}</p>
            </div>
            <div className="rounded bg-muted/50 px-2.5 py-1.5">
              <p className="text-[9px] text-muted-foreground">Montante médio</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{fmt(item.historicalPattern.avgAmount)}</p>
            </div>
            <div className="rounded bg-muted/50 px-2.5 py-1.5">
              <p className="text-[9px] text-muted-foreground">Conta consistente</p>
              <p className={cn("text-sm font-semibold", item.historicalPattern.consistentAccount ? "text-tim-success" : "text-tim-warning")}>
                {item.historicalPattern.consistentAccount ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Source data */}
      <div className="border-b px-4 py-3">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowSources(!showSources)}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dados fonte</span>
          </div>
          {showSources ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {showSources && (
          <ul className="mt-2 space-y-1">
            {item.sourceData.map((src, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                <span className="text-[10px] text-foreground/70">{src}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Supplier rule */}
      {item.supplierRule && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Regra de fornecedor</span>
          </div>
          {item.supplierRule.exists ? (
            <div className="rounded bg-tim-success/5 border border-tim-success/20 px-3 py-2">
              <p className="text-xs text-tim-success font-medium">{item.supplierRule.pattern}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Regra ativa · ID: {item.supplierRule.ruleId}</p>
            </div>
          ) : (
            <div className="rounded bg-muted/50 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Sem regra definida para esta entidade</p>
              {item.detectedEntity && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-[10px]"
                  onClick={() => onCreateRule(item.id)}
                >
                  <Plus className="mr-1 h-3 w-3" /> Criar regra para {item.detectedEntity}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isResolved && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-tim-success hover:bg-tim-success/90 text-tim-success-foreground"
              onClick={() => onApprove(item.id)}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={startEdit}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => onReject(item.id)}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
            </Button>
          </div>
          {!item.isRecurring && item.detectedEntity && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-[10px] text-muted-foreground"
              onClick={() => onMarkRecurring(item.id)}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Marcar como recorrente
            </Button>
          )}
        </div>
      )}

      {isResolved && (
        <div className="px-4 py-3">
          <div className={cn(
            "rounded px-3 py-2 text-center text-xs font-medium",
            item.status === "aprovado" ? "bg-tim-success/10 text-tim-success" : "bg-destructive/10 text-destructive"
          )}>
            {item.status === "aprovado" ? "✓ Classificação aprovada" : "✗ Classificação rejeitada"}
          </div>
        </div>
      )}
    </div>
  );
}
