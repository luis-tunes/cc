import { useState } from "react";
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
import { ColumnToggle, type ColumnConfig } from "@/components/shared/ColumnToggle";
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
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "tim:movement-columns";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "date", label: "Data", visible: true },
  { key: "description", label: "Descrição", visible: true },
  { key: "reference", label: "Ref.", visible: true },
  { key: "amount", label: "Montante", visible: true },
  { key: "account", label: "Conta", visible: true },
  { key: "sncClass", label: "Classe SNC", visible: true },
  { key: "entity", label: "Entidade", visible: true },
  { key: "status", label: "Estado", visible: true },
  { key: "confidence", label: "Confiança", visible: true },
  { key: "flags", label: "Alertas", visible: true },
];

function loadColumns(): ColumnConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const saved = JSON.parse(raw) as Record<string, boolean>;
    return DEFAULT_COLUMNS.map((c) => ({
      ...c,
      visible: saved[c.key] ?? c.visible,
    }));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

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
  const isMobile = useIsMobile();

  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumns);

  const handleColumnChange = (key: string, visible: boolean) => {
    setColumns((prev) => {
      const next = prev.map((c) => (c.key === key ? { ...c, visible } : c));
      const map: Record<string, boolean> = {};
      for (const c of next) map[c.key] = c.visible;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      return next;
    });
  };

  const isVisible = (key: string) => columns.find((c) => c.key === key)?.visible !== false;

  if (isMobile) {
    return (
      <div className={cn("space-y-2", className)}>
        {movements.map((mv) => {
          const isDebit = mv.type === "debito";
          const hasFlags = mv.isAnomaly || mv.isDuplicate;
          return (
            <div
              key={mv.id}
              onClick={() => onOpenMovement(mv)}
              className={cn(
                "rounded-lg border bg-card p-3 active:bg-accent/50 transition-colors cursor-pointer",
                hasFlags && "border-tim-danger/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isDebit ? (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-tim-danger/70" />
                    ) : (
                      <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-tim-success/70" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{mv.description}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mv.date}</p>
                </div>
                <span className={cn(
                  "text-sm font-mono font-semibold tabular-nums whitespace-nowrap",
                  isDebit ? "text-foreground" : "text-tim-success"
                )}>
                  {isDebit ? "-" : "+"}€{Math.abs(mv.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={mv.classificationStatus} />
                {mv.detectedEntity && (
                  <span className="truncate text-xs text-muted-foreground">{mv.detectedEntity}</span>
                )}
                {hasFlags && (
                  <div className="ml-auto flex items-center gap-1">
                    {mv.isAnomaly && <AlertTriangle className="h-3 w-3 text-tim-danger" />}
                    {mv.isDuplicate && <Copy className="h-3 w-3 text-tim-warning" />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ColumnToggle columns={columns} onChange={handleColumnChange} />
      </div>
      <div
        ref={containerRef}
        tabIndex={0}
        className={cn("rounded-lg border bg-card overflow-x-auto outline-none", className)}
      >
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {isVisible("date") && <TableHead className="w-24 text-sm font-medium text-muted-foreground">Data</TableHead>}
            {isVisible("description") && <TableHead className="text-sm font-medium text-muted-foreground">Descrição</TableHead>}
            {isVisible("reference") && <TableHead className="w-20 text-sm font-medium text-muted-foreground">Ref.</TableHead>}
            {isVisible("amount") && <TableHead className="w-28 text-right text-sm font-medium text-muted-foreground">Montante</TableHead>}
            {isVisible("account") && <TableHead className="w-24 text-sm font-medium text-muted-foreground">Conta</TableHead>}
            {isVisible("sncClass") && <TableHead className="w-32 text-sm font-medium text-muted-foreground">Classe SNC</TableHead>}
            {isVisible("entity") && <TableHead className="w-36 text-sm font-medium text-muted-foreground">Entidade</TableHead>}
            {isVisible("status") && <TableHead className="w-28 text-sm font-medium text-muted-foreground">Estado</TableHead>}
            {isVisible("confidence") && <TableHead className="w-20 text-sm font-medium text-muted-foreground">Confiança</TableHead>}
            {isVisible("flags") && <TableHead className="w-10" />}
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
                  "tim-table-row border-border cursor-pointer",
                  hasFlags && "bg-tim-danger/[0.03]",
                  mv.classificationStatus === "pendente" && !hasFlags && "bg-tim-warning/[0.02]",
                  isFocused && "ring-1 ring-inset ring-primary/40 bg-primary/5"
                )}
                onClick={() => onOpenMovement(mv)}
              >
                {isVisible("date") && <TableCell className="text-xs font-mono text-muted-foreground">
                  {mv.date}
                </TableCell>}
                {isVisible("description") && <TableCell>
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
                </TableCell>}
                {isVisible("reference") && <TableCell className="text-sm font-mono text-muted-foreground">
                  {mv.reference || "—"}
                </TableCell>}
                {isVisible("amount") && <TableCell className="text-right">
                  <span
                    className={cn(
                      "text-sm font-mono font-semibold tabular-nums",
                      isDebit ? "text-foreground" : "text-tim-success"
                    )}
                  >
                    {isDebit ? "-" : "+"}€{Math.abs(mv.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </span>
                </TableCell>}
                {isVisible("account") && <TableCell>
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
                </TableCell>}
                {isVisible("sncClass") && <TableCell>
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
                </TableCell>}
                {isVisible("entity") && <TableCell>
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
                </TableCell>}
                {isVisible("status") && <TableCell>
                  <StatusBadge status={mv.classificationStatus} />
                </TableCell>}
                {isVisible("confidence") && <TableCell>
                  <ConfidenceIndicator value={mv.confidence} size="sm" />
                </TableCell>}
                {isVisible("flags") && <TableCell>
                  <div className="flex items-center gap-1">
                    {mv.isAnomaly && <AlertTriangle className="h-3 w-3 text-tim-danger" />}
                    {mv.isDuplicate && <Copy className="h-3 w-3 text-tim-warning" />}
                    {mv.linkedDocumentId && <FileText className="h-3 w-3 text-tim-info/60" />}
                  </div>
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
