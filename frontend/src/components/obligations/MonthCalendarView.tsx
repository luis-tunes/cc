import { cn } from "@/lib/utils";
import { obligationEntries, categoryConfig, monthNames } from "@/lib/obligations-data";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MonthCalendarView({ className }: { className?: string }) {
  const [currentMonth, setCurrentMonth] = useState(2); // March (0-indexed)
  const [currentYear] = useState(2024);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust for Monday start
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const monthObs = obligationEntries.filter(
    (o) => o.deadlineDate.getMonth() === currentMonth && o.deadlineDate.getFullYear() === currentYear
  );

  const getObsForDay = (day: number) =>
    monthObs.filter((o) => o.deadlineDate.getDate() === day);

  const today = 8; // Mock: March 8

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Calendário</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium text-foreground w-28 text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth((p) => Math.min(11, p + 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d} className="text-center text-[9px] font-medium uppercase tracking-widest text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const obs = getObsForDay(day);
            const isToday = day === today;
            const hasObs = obs.length > 0;
            const hasUrgent = obs.some((o) => o.daysLeft <= 3 && o.status !== "concluído");

            return (
              <div
                key={day}
                className={cn(
                  "relative h-16 border border-border/30 p-1 transition-colors hover:bg-accent/30",
                  isToday && "bg-primary/5 border-primary/30",
                  hasUrgent && "bg-tim-danger/5"
                )}
              >
                <span className={cn(
                  "text-[10px] tabular-nums",
                  isToday ? "font-bold text-primary" : "text-muted-foreground",
                  day < today && "text-muted-foreground/50"
                )}>
                  {day}
                </span>
                {hasObs && (
                  <div className="mt-0.5 space-y-0.5">
                    {obs.slice(0, 2).map((o) => {
                      const cat = categoryConfig[o.category];
                      return (
                        <div
                          key={o.id}
                          className={cn("rounded px-1 py-0.5 truncate text-[8px] font-medium", cat.bgColor, cat.color)}
                          title={o.title}
                        >
                          {cat.label}
                        </div>
                      );
                    })}
                    {obs.length > 2 && (
                      <span className="text-[8px] text-muted-foreground">+{obs.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
