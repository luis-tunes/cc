import { cn } from "@/lib/utils";
import { useState } from "react";
import { sncClasses } from "@/lib/classifications-data";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const classColors: Record<number, string> = {
  1: "bg-tim-info/15 text-tim-info",
  2: "bg-primary/15 text-primary",
  3: "bg-tim-warning/15 text-tim-warning",
  4: "bg-chart-3/15 text-chart-3",
  5: "bg-muted text-muted-foreground",
  6: "bg-tim-danger/15 text-tim-danger",
  7: "bg-tim-success/15 text-tim-success",
  8: "bg-primary/10 text-primary",
};

export function SncAccountMap({ className }: { className?: string }) {
  const [openClasses, setOpenClasses] = useState<number[]>([6, 7]);

  const toggle = (code: number) => {
    setOpenClasses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const fmt = (v: number) => `€${v.toLocaleString("pt-PT")}`;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Plano de Contas SNC</h3>
        <span className="text-xs text-muted-foreground">8 classes</span>
      </div>

      <div className="divide-y divide-border">
        {sncClasses.map((cls) => {
          const isOpen = openClasses.includes(cls.code);
          const totalMov = cls.accounts.reduce((s, a) => s + a.movementCount, 0);
          const totalAmt = cls.accounts.reduce((s, a) => s + a.totalAmount, 0);
          const hasWarnings = cls.accounts.some((a) => a.hasWarning);

          return (
            <Collapsible key={cls.code} open={isOpen} onOpenChange={() => toggle(cls.code)}>
              <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors">
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-90")} />
                <span className={cn("flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold shrink-0", classColors[cls.code])}>
                  {cls.code}
                </span>
                <span className="flex-1 text-xs font-medium text-foreground">{cls.label}</span>
                {hasWarnings && <AlertTriangle className="h-3 w-3 text-tim-warning shrink-0" />}
                <span className="text-[10px] tabular-nums text-muted-foreground">{totalMov} mov</span>
                <span className="text-[10px] tabular-nums font-medium text-foreground w-20 text-right">{fmt(totalAmt)}</span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="pb-1">
                  {cls.accounts.map((acc) => (
                    <div
                      key={acc.code}
                      className={cn(
                        "flex items-center gap-3 pl-14 pr-4 py-2 hover:bg-accent/30 transition-colors",
                        acc.hasWarning && "bg-tim-warning/5"
                      )}
                    >
                      <span className="text-xs font-mono font-medium text-primary w-10">{acc.code}</span>
                      <span className="flex-1 text-xs text-foreground">{acc.label}</span>
                      {acc.hasWarning && (
                        <span className="text-[9px] text-tim-warning max-w-48 truncate" title={acc.warningText}>
                          {acc.warningText}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-muted-foreground">{acc.movementCount}</span>
                      <span className={cn(
                        "text-[10px] tabular-nums font-medium w-20 text-right",
                        acc.movementCount > 0 ? "text-foreground" : "text-muted-foreground/50"
                      )}>
                        {fmt(acc.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
