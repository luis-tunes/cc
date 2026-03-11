import { cn } from "@/lib/utils";
import { Bot, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

interface AiSuggestionCardProps {
  title: string;
  description: string;
  confidence: number;
  source?: string;
  onAccept?: () => void;
  onReject?: () => void;
  onReview?: () => void;
  className?: string;
}

export function AiSuggestionCard({
  title,
  description,
  confidence,
  source,
  onAccept,
  onReject,
  onReview,
  className,
}: AiSuggestionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-primary/30 bg-card p-4",
        "shadow-[0_0_20px_-5px_hsl(var(--tim-gold)/0.1)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-primary">
            Sugerido por IA
          </span>
        </div>
        <ConfidenceIndicator value={confidence} size="sm" />
      </div>

      <h4 className="mt-3 text-sm font-medium text-foreground">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {source && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Fonte: <span className="text-foreground/70">{source}</span>
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {onAccept && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-tim-success/30 text-tim-success hover:bg-tim-success/10"
            onClick={onAccept}
          >
            <Check className="mr-1 h-3 w-3" />
            Aceitar
          </Button>
        )}
        {onReview && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={onReview}
          >
            <Eye className="mr-1 h-3 w-3" />
            Rever
          </Button>
        )}
        {onReject && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-muted-foreground hover:text-tim-danger"
            onClick={onReject}
          >
            <X className="mr-1 h-3 w-3" />
            Rejeitar
          </Button>
        )}
      </div>
    </div>
  );
}
