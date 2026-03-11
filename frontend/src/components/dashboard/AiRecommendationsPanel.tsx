import { cn } from "@/lib/utils";
import { Bot, ChevronRight } from "lucide-react";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";

interface AiRecommendation {
  text: string;
  confidence: number;
  type: "classification" | "anomaly" | "reminder" | "optimization";
}

const recommendations: AiRecommendation[] = [
  {
    text: "3 movimentos parecem pertencer à classe 62 — FSE",
    confidence: 91,
    type: "classification",
  },
  {
    text: "Despesa anómala em utilities (+340% vs média)",
    confidence: 78,
    type: "anomaly",
  },
  {
    text: "Falta classificar 12 documentos importados",
    confidence: 100,
    type: "reminder",
  },
  {
    text: "Prazo fiscal — Retenções na Fonte em 12 dias",
    confidence: 100,
    type: "reminder",
  },
  {
    text: "Ativo #A-0023 sem taxa de depreciação definida",
    confidence: 95,
    type: "optimization",
  },
];

const typeStyles: Record<string, { dot: string; bg: string }> = {
  classification: { dot: "bg-primary", bg: "hover:bg-primary/5" },
  anomaly: { dot: "bg-tim-danger", bg: "hover:bg-tim-danger/5" },
  reminder: { dot: "bg-tim-warning", bg: "hover:bg-tim-warning/5" },
  optimization: { dot: "bg-tim-info", bg: "hover:bg-tim-info/5" },
};

export function AiRecommendationsPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-primary/20 bg-card", className)}>
      <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Recomendações IA
          </h3>
        </div>
        <span className="text-[10px] font-medium text-primary">
          {recommendations.length} sugestões
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {recommendations.map((rec, i) => {
          const style = typeStyles[rec.type];
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer",
                style.bg
              )}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
              <p className="flex-1 text-xs text-foreground">{rec.text}</p>
              <ConfidenceIndicator value={rec.confidence} size="sm" />
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
