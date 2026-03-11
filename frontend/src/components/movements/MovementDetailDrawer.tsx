import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Check,
  Pencil,
  Clock,
  FileText,
  AlertTriangle,
  Copy,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import type { BankMovement } from "@/lib/movements-data";

interface MovementDetailDrawerProps {
  movement: BankMovement | null;
  open: boolean;
  onClose: () => void;
}

export function MovementDetailDrawer({ movement, open, onClose }: MovementDetailDrawerProps) {
  if (!movement) return null;

  const isDebit = movement.type === "debito";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-lg overflow-y-auto border-l bg-card p-0 sm:max-w-xl">
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 border-b bg-card px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "rounded-md p-2",
                isDebit ? "bg-tim-danger/10" : "bg-tim-success/10"
              )}
            >
              {isDebit ? (
                <ArrowUpRight className="h-4 w-4 text-tim-danger" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-tim-success" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold text-foreground">
                {movement.description}
              </SheetTitle>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <StatusBadge status={movement.classificationStatus} />
                <StatusBadge status={movement.reconciliationStatus} />
                {movement.isAnomaly && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-tim-danger/30 bg-tim-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-tim-danger">
                    <AlertTriangle className="h-2.5 w-2.5" /> Anomalia
                  </span>
                )}
                {movement.isDuplicate && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-tim-warning/30 bg-tim-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-tim-warning">
                    <Copy className="h-2.5 w-2.5" /> Possível duplicado
                  </span>
                )}
                {movement.isRecurring && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <RotateCcw className="h-2.5 w-2.5" /> Recorrente
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="divide-y">
          {/* Amount */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs text-muted-foreground">Montante</span>
            <span
              className={cn(
                "text-xl font-bold font-mono tabular-nums",
                isDebit ? "text-foreground" : "text-tim-success"
              )}
            >
              {isDebit ? "-" : "+"}€{Math.abs(movement.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Transaction details */}
          <div className="px-5 py-4">
            <SectionTitle>Detalhes da Transação</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <InfoItem label="Data" value={movement.date} />
              <InfoItem label="Referência" value={movement.reference || "—"} mono />
              <InfoItem label="Tipo" value={isDebit ? "Débito" : "Crédito"} />
              <InfoItem label="Origem" value={movement.origin === "csv" ? "Importação CSV" : movement.origin === "sync" ? "Sync bancário" : "Manual"} />
            </div>
          </div>

          {/* AI Classification suggestion */}
          <div className="px-5 py-4">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-primary">
                  Classificação Sugerida
                </span>
                <ConfidenceIndicator value={movement.confidence} size="sm" className="ml-auto" />
              </div>

              {movement.suggestedAccount && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Conta SNC</p>
                    <p className="mt-0.5 text-sm font-semibold text-primary font-mono">
                      {movement.suggestedAccount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Classe</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {movement.sncClass || "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Detected entity */}
              {movement.detectedEntity && (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground">
                    {movement.detectedEntityType === "fornecedor" ? "Fornecedor detetado" : "Cliente detetado"}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {movement.detectedEntity}
                  </p>
                </div>
              )}

              {/* AI explanation */}
              {movement.aiExplanation && (
                <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Porquê esta sugestão?
                  </p>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {movement.aiExplanation}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-tim-success/30 text-tim-success hover:bg-tim-success/10"
                >
                  <Check className="mr-1 h-3 w-3" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Pencil className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" /> Adiar
                </Button>
              </div>
            </div>
          </div>

          {/* Linked document */}
          {movement.linkedDocumentId && (
            <div className="px-5 py-4">
              <SectionTitle>Documento Associado</SectionTitle>
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {movement.linkedDocumentName}
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          )}

          {!movement.linkedDocumentId && (
            <div className="px-5 py-4">
              <SectionTitle>Documento Associado</SectionTitle>
              <div className="mt-2 flex items-center justify-center rounded-md border border-dashed bg-muted/20 px-3 py-4">
                <p className="text-xs text-muted-foreground">
                  Nenhum documento associado — <span className="text-primary cursor-pointer hover:underline">procurar correspondência</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xs text-foreground", mono && "font-mono")}>{value}</p>
    </div>
  );
}
