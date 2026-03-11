import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiCommentary } from "@/lib/forecast-data";
import { Brain, AlertTriangle, Lightbulb, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const typeConfig = {
  insight: { icon: Lightbulb, color: "text-tim-info", accent: "border-l-tim-info" },
  warning: { icon: AlertTriangle, color: "text-tim-warning", accent: "border-l-tim-warning" },
  action: { icon: Zap, color: "text-tim-success", accent: "border-l-tim-success" },
};

export function AiCommentaryPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-primary" />
          Análise TIM
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {aiCommentary.map((c) => {
          const cfg = typeConfig[c.type];
          const Icon = cfg.icon;
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-md border-l-2 bg-secondary/40 px-3 py-2.5",
                cfg.accent
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cfg.color)} />
                <p className="text-xs leading-relaxed text-foreground/90">{c.text}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
