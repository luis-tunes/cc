import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Check,
  Flag,
  Bot,
  HelpCircle,
  Landmark,
} from "lucide-react";
import type { ReconciliationPair, MatchStatus } from "@/lib/reconciliation-data";

interface MatchCardProps {
  pair: ReconciliationPair;
  onApprove: (id: string) => void;
  onReview: (id: string) => void;
  onFlag: (id: string) => void;
  className?: string;
}

const statusConfig: Record<MatchStatus, { label: string; icon: any; color: string; border: string }> = {
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-tim-success", border: "border-tim-success/20" },
  "auto-matched": { label: "Auto-reconciliado", icon: Bot, color: "text-primary", border: "border-primary/20" },
  suggested: { label: "Sugestão IA", icon: Clock, color: "text-tim-warning", border: "border-tim-warning/20" },
  exception: { label: "Exceção", icon: AlertTriangle, color: "text-tim-danger", border: "border-tim-danger/20" },
  unmatched: { label: "Sem par", icon: HelpCircle, color: "text-muted-foreground", border: "border-border" },
};

export function MatchCard({ pair, onApprove, onReview, onFlag, className }: MatchCardProps) {
  const config = statusConfig[pair.status];
  const StatusIcon = config.icon;
  const isUnmatched = !pair.document || !pair.movement;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors",
        config.border,
        pair.status === "exception" && "bg-tim-danger/[0.02]",
        pair.status === "suggested" && "bg-tim-warning/[0.02]",
        className
      )}
    >
      {/* Status header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
          <span className={cn("text-xs font-semibold uppercase tracking-wider", config.color)}>
            {config.label}
          </span>
        </div>
        <ConfidenceIndicator value={pair.confidence} size="sm" />
      </div>

      {/* Body: side-by-side on desktop, stacked on mobile */}
      <div className={cn("grid gap-0", isUnmatched ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[1fr_auto_1fr]")}>
        {/* Left: Document */}
        {pair.document ? (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Documento
              </span>
            </div>
            <p className="truncate text-xs font-medium text-foreground">{pair.document.fileName}</p>
            <div className="mt-2 space-y-1">
              <MetaRow label="Entidade" value={pair.document.supplier || pair.document.customer || "—"} />
              <MetaRow
                label="Montante"
                value={`€${pair.document.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
                highlight
              />
              <MetaRow
                label="IVA"
                value={`€${pair.document.vat.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
              />
              <MetaRow label="Data" value={pair.document.date} />
              <MetaRow label="Tipo" value={pair.document.type} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-l-lg bg-muted/20 p-6">
            <FileText className="h-6 w-6 text-muted-foreground/30" />
            <p className="mt-2 text-xs text-muted-foreground">Sem documento associado</p>
          </div>
        )}

        {/* Center: Match indicator */}
        {!isUnmatched && (
          <div className="flex flex-row items-center justify-center gap-3 border-t px-4 py-3 sm:flex-col sm:border-t-0 sm:border-x sm:py-4">
            <ConfidenceIndicator value={pair.confidence} size="md" variant="donut" />
            {pair.amountDelta === 0 && (
              <span className="text-xs text-tim-success sm:mt-1">Valor exato</span>
            )}
            {pair.dateDelta > 0 && (
              <span className={cn("text-xs", pair.dateDelta <= 3 ? "text-muted-foreground" : "text-tim-warning")}>
                {pair.dateDelta}d diferença
              </span>
            )}
          </div>
        )}

        {/* Right: Movement */}
        {pair.movement ? (
          <div className="border-t p-4 sm:border-t-0">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Movimento
              </span>
            </div>
            <p className="truncate text-xs font-medium text-foreground">{pair.movement.description}</p>
            <div className="mt-2 space-y-1">
              <MetaRow
                label="Montante"
                value={`${pair.movement.amount < 0 ? "-" : "+"}€${Math.abs(pair.movement.amount).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
                highlight
              />
              <MetaRow label="Data" value={pair.movement.date} />
              <MetaRow label="Ref." value={pair.movement.reference || "—"} mono />
              {pair.movement.classification && (
                <MetaRow label="Conta" value={pair.movement.classification} mono />
              )}
              {pair.movement.sncClass && (
                <MetaRow label="Classe" value={pair.movement.sncClass} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-r-lg bg-muted/20 border-t p-6 sm:border-t-0">
            <Landmark className="h-6 w-6 text-muted-foreground/30" />
            <p className="mt-2 text-xs text-muted-foreground">Sem movimento associado</p>
          </div>
        )}
      </div>

      {/* Reasoning */}
      {pair.reasoning && (
        <div className="border-t px-4 py-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <Bot className="mr-1 inline h-3 w-3 text-primary/70" />
            {pair.reasoning}
          </p>
        </div>
      )}

      {/* Exceptions */}
      {pair.exceptions && pair.exceptions.length > 0 && (
        <div className="border-t bg-tim-danger/[0.03] px-4 py-2">
          {pair.exceptions.map((ex, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-tim-danger">
              <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
              {ex}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      {pair.status !== "approved" && (
        <div className="flex items-center gap-2 border-t px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs border-tim-success/30 text-tim-success hover:bg-tim-success/10"
            onClick={() => onApprove(pair.id)}
          >
            <Check className="mr-1 h-2.5 w-2.5" /> Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => onReview(pair.id)}
          >
            <Eye className="mr-1 h-2.5 w-2.5" /> Rever
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => onFlag(pair.id)}
          >
            <Flag className="mr-1 h-2.5 w-2.5" /> Exceção
          </Button>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right text-xs",
          highlight ? "font-semibold text-foreground" : "text-foreground/80",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}
