import { cn } from "@/lib/utils";
import { classificationRules } from "@/lib/classifications-data";
import { Brain, User, Repeat, Zap, ArrowRightLeft, Settings2 } from "lucide-react";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";

const typeConfig = {
  fornecedor: { label: "Fornecedor", icon: User, className: "bg-primary/10 text-primary" },
  padrão: { label: "Padrão", icon: Repeat, className: "bg-tim-info/10 text-tim-info" },
  correção: { label: "Correção", icon: ArrowRightLeft, className: "bg-tim-warning/10 text-tim-warning" },
  atalho: { label: "Atalho", icon: Zap, className: "bg-tim-success/10 text-tim-success" },
};

export function RulesMemoryPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Regras e Memória</h3>
        </div>
        <span className="text-xs text-muted-foreground">{classificationRules.length} regras ativas</span>
      </div>

      <div className="divide-y divide-border">
        {classificationRules.map((rule) => {
          const cfg = typeConfig[rule.type];
          const TypeIcon = cfg.icon;

          return (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors">
              <div className={cn("flex h-6 w-6 items-center justify-center rounded shrink-0", cfg.className)}>
                <TypeIcon className="h-3.5 w-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground truncate">{rule.pattern}</p>
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
                    cfg.className
                  )}>
                    {cfg.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold text-primary">{rule.account}</span>
                  <span className="text-[10px] text-muted-foreground">{rule.accountLabel}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <ConfidenceIndicator value={rule.confidence} size="sm" />
                <div className="text-right">
                  <p className="text-[10px] tabular-nums text-muted-foreground">{rule.timesApplied}× aplicada</p>
                  <p className="text-[9px] text-muted-foreground/70">{rule.lastUsed}</p>
                </div>
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-medium",
                  rule.source === "ia" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {rule.source === "ia" ? "IA" : "Manual"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
