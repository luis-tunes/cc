import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptimizationRecommendation, recommendations } from "@/lib/cost-optimization-data";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import { cn } from "@/lib/utils";
import { Brain, ArrowRight, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const typeConfig = {
  cost: { icon: TrendingDown, label: "Redução custo", color: "text-tim-success" },
  revenue: { icon: TrendingUp, label: "Oportunidade receita", color: "text-tim-info" },
  efficiency: { icon: Zap, label: "Eficiência", color: "text-primary" },
};

const priorityConfig = {
  alta: { bg: "bg-tim-danger/10", text: "text-tim-danger", border: "border-tim-danger/20" },
  media: { bg: "bg-tim-warning/10", text: "text-tim-warning", border: "border-tim-warning/20" },
  baixa: { bg: "bg-tim-info/10", text: "text-tim-info", border: "border-tim-info/20" },
};

export function RecommendationsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(recommendations[0]?.id ?? null);

  const sorted = [...recommendations].sort((a, b) => {
    const pOrder = { alta: 0, media: 1, baixa: 2 };
    return pOrder[a.priority] - pOrder[b.priority] || b.confidence - a.confidence;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-primary" />
          Recomendações de Otimização
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {sorted.length} oportunidades · €{recommendations.reduce((s, r) => s + r.annualSaving, 0).toLocaleString("pt-PT")}/ano potencial
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((rec) => {
          const isOpen = expandedId === rec.id;
          const pCfg = priorityConfig[rec.priority];
          const tCfg = typeConfig[rec.type];
          const TypeIcon = tCfg.icon;

          return (
            <div
              key={rec.id}
              className={cn(
                "rounded-lg border transition-all",
                isOpen ? "border-border bg-secondary/30" : "border-border/50"
              )}
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : rec.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <TypeIcon className={cn("mt-0.5 h-4 w-4 shrink-0", tCfg.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug text-foreground">
                    {rec.issue}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        pCfg.bg,
                        pCfg.text
                      )}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{rec.category}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="font-mono text-[10px] font-semibold text-tim-success">
                      {rec.estimatedImpact}
                    </span>
                  </div>
                </div>
                <ConfidenceIndicator value={rec.confidence} size="sm" />
              </button>

              {isOpen && (
                <div className="border-t border-border/50 px-4 py-3">
                  {/* Reasoning */}
                  <div className="mb-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Análise
                    </p>
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {rec.reasoning}
                    </p>
                  </div>

                  {/* Impact + Confidence */}
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-secondary/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Impacto estimado</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-tim-success">
                        {rec.estimatedImpact}
                      </p>
                    </div>
                    <div className="rounded-md bg-secondary/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Confiança da análise</p>
                      <div className="mt-1">
                        <ConfidenceIndicator value={rec.confidence} size="md" />
                      </div>
                    </div>
                  </div>

                  {/* Next action */}
                  <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Próximo passo
                      </p>
                      <p className="mt-0.5 text-xs text-foreground">{rec.nextAction}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]">
                      Agir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
