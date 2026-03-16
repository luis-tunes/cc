import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import {
  AlertTriangle,
  Copy,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import type { BankMovement } from "@/lib/movements-data";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

interface MovementLedgerProps {
  movements: BankMovement[];
  onOpenMovement: (m: BankMovement) => void;
  className?: string;
}

export function MovementLedger({
  movements,
  onOpenMovement,
  className,
}: MovementLedgerProps) {
  const { focusedIndex, containerRef } = useKeyboardNav(movements.length);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn("rounded-lg border bg-card overflow-x-auto outline-none", className)}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-24 text-sm font-medium text-muted-foreground">Data</TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground">Descrição</TableHead>
            <TableHead className="w-20 text-sm font-medium text-muted-foreground">Ref.</TableHead>
            <TableHead className="w-28 text-right text-sm font-medium text-muted-foreground">Montante</TableHead>
            <TableHead className="w-24 text-sm font-medium text-muted-foreground">Conta</TableHead>
            <TableHead className="w-32 text-sm font-medium text-muted-foreground">Classe SNC</TableHead>
            <TableHead className="w-36 text-sm font-medium text-muted-foreground">Entidade</TableHead>
            <TableHead className="w-28 text-sm font-medium text-muted-foreground">Estado</TableHead>
            <TableHead className="w-20 text-sm font-medium text-muted-foreground">Confiança</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((mv, idx) => {
            const isDebit = mv.type === "debito";
            const hasFlags = mv.isAnomaly || mv.isDuplicate;
            const isFocused = focusedIndex === idx;

            return (
              <TableRow
                key={mv.id}
                className={cn(
                  "border-border cursor-pointer transition-colors",
                  hasFlags && "bg-tim-danger/[0.03]",
                  mv.classificationStatus === "pendente" && !hasFlags && "bg-tim-warning/[0.02]",
                  isFocused && "ring-1 ring-inset ring-primary/40 bg-primary/5"
                )}
                onClick={() => onOpenMovement(mv)}
              >
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {mv.date}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isDebit ? (
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-tim-danger/70" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3 shrink-0 text-tim-success/70" />
                    )}
                    <span className="truncate text-xs font-medium text-foreground max-w-[220px]">
                      {mv.description}
                    </span>
                    {mv.isRecurring && (
                      <RotateCcw className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">
                  {mv.reference || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "text-sm font-mono font-semibold tabular-nums",
                      isDebit ? "text-foreground" : "text-tim-success"
                    )}
                  >
                    {isDebit ? "-" : "+"}€{Math.abs(mv.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </span>
                </TableCell>
                <TableCell>
                  {mv.suggestedAccount ? (
                    <span
                      className={cn(
                        "text-xs font-mono",
                        mv.classificationStatus === "classificado" || mv.classificationStatus === "revisto"
                          ? "text-foreground"
                          : "text-primary/80 italic"
                      )}
                    >
                      {mv.suggestedAccount}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {mv.sncClass ? (
                    <span
                      className={cn(
                        "text-xs",
                        mv.classificationStatus === "classificado" || mv.classificationStatus === "revisto"
                          ? "text-muted-foreground"
                          : "text-primary/70 italic"
                      )}
                    >
                      {mv.sncClass}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {mv.detectedEntity ? (
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground max-w-[130px]">{mv.detectedEntity}</p>
                      {mv.detectedEntityType && (
                        <p className="text-xs text-muted-foreground capitalize">{mv.detectedEntityType}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={mv.classificationStatus} />
                </TableCell>
                <TableCell>
                  <ConfidenceIndicator value={mv.confidence} size="sm" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {mv.isAnomaly && <AlertTriangle className="h-3 w-3 text-tim-danger" />}
                    {mv.isDuplicate && <Copy className="h-3 w-3 text-tim-warning" />}
                    {mv.linkedDocumentId && <FileText className="h-3 w-3 text-tim-info/60" />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
