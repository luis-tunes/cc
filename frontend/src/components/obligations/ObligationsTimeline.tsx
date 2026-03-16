import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  obligationEntries,
  getObligationsByMonth,
  monthNames,
  categoryConfig,
  statusConfig,
  type ObligationEntry,
} from "@/lib/obligations-data";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, AlertTriangle, Clock, CheckCircle2, Lock, Bell } from "lucide-react";

function ObligationRow({ ob }: { ob: ObligationEntry }) {
  const cat = categoryConfig[ob.category];
  const stat = statusConfig[ob.status];
  const urgent = ob.daysLeft > 0 && ob.daysLeft <= 3;
  const near = ob.daysLeft > 3 && ob.daysLeft <= 7;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50",
        urgent && "bg-tim-danger/5",
        near && "bg-tim-warning/5",
        ob.status === "concluído" && "opacity-50"
      )}
    >
      {/* Category badge */}
      <span className={cn("rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider shrink-0 w-16 text-center", cat.bgColor, cat.color)}>
        {cat.label}
      </span>

      {/* Title + blockers */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground truncate">{ob.title}</p>
          {ob.reminderSet && <Bell className="h-3 w-3 text-primary shrink-0" />}
        </div>
        {ob.blockers.length > 0 && (
          <div className="mt-0.5 flex items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-tim-danger shrink-0" />
            <span className="text-xs text-tim-danger truncate">
              {ob.blockers[0]}{ob.blockers.length > 1 && ` (+${ob.blockers.length - 1})`}
            </span>
          </div>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{ob.nextAction}</p>
      </div>

      {/* Readiness */}
      <div className="w-20 shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-muted-foreground">Prontidão</span>
          <span className={cn("text-xs font-semibold tabular-nums", ob.readiness >= 80 ? "text-tim-success" : ob.readiness >= 40 ? "text-tim-warning" : "text-tim-danger")}>
            {ob.readiness}%
          </span>
        </div>
        <Progress value={ob.readiness} className="h-1 bg-muted" />
      </div>

      {/* Status */}
      <span className={cn("rounded px-2 py-0.5 text-xs font-medium shrink-0", stat.bgColor, stat.color)}>
        {stat.label}
      </span>

      {/* Days left */}
      {ob.status !== "concluído" && (
        <span className={cn(
          "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums shrink-0 w-10 text-center",
          ob.daysLeft <= 3 && "bg-tim-danger/15 text-tim-danger",
          ob.daysLeft > 3 && ob.daysLeft <= 7 && "bg-tim-warning/15 text-tim-warning",
          ob.daysLeft > 7 && ob.daysLeft <= 30 && "bg-muted text-muted-foreground",
          ob.daysLeft > 30 && "bg-muted text-muted-foreground/60"
        )}>
          {ob.daysLeft}d
        </span>
      )}
      {ob.status === "concluído" && (
        <CheckCircle2 className="h-4 w-4 text-tim-success shrink-0" />
      )}
    </div>
  );
}

export function ObligationsTimeline({ className }: { className?: string }) {
  const grouped = getObligationsByMonth(obligationEntries);
  const sortedKeys = Object.keys(grouped).sort();

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Linha Temporal</h3>
        <span className="text-xs text-muted-foreground">
          {obligationEntries.filter((o) => o.status !== "concluído").length} ativas
        </span>
      </div>

      <div className="divide-y divide-border">
        {sortedKeys.map((key) => {
          const [year, month] = key.split("-");
          const label = `${monthNames[parseInt(month) - 1]} ${year}`;
          const items = grouped[key].sort((a, b) => a.daysLeft - b.daysLeft);
          const hasUrgent = items.some((i) => i.daysLeft > 0 && i.daysLeft <= 7 && i.status !== "concluído");

          return (
            <div key={key} className="py-1">
              <div className="flex items-center gap-2 px-4 py-2">
                <div className={cn("h-2 w-2 rounded-full", hasUrgent ? "bg-tim-warning" : "bg-border")} />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
              </div>
              <div className="px-1 pb-1 space-y-0.5">
                {items.map((ob) => (
                  <ObligationRow key={ob.id} ob={ob} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
