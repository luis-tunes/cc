import { PageContainer } from "@/components/layout/PageContainer";
import { ObligationsTimeline } from "@/components/obligations/ObligationsTimeline";
import { MonthCalendarView } from "@/components/obligations/MonthCalendarView";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { PreparationChecklist } from "@/components/obligations/PreparationChecklist";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CalendarDays, List, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Obligations() {
  const [view, setView] = useState<"agenda" | "calendario">("agenda");

  return (
    <PageContainer
      title="Obrigações"
      subtitle="Calendário de obrigações fiscais, legais e operacionais"
      actions={
        <div className="flex gap-2">
          <div className="flex rounded-md border bg-muted p-0.5">
            <button
              className={cn(
                "rounded px-3 py-1 text-[10px] font-medium transition-colors",
                view === "agenda" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("agenda")}
            >
              <List className="mr-1 inline h-3 w-3" />
              Agenda
            </button>
            <button
              className={cn(
                "rounded px-3 py-1 text-[10px] font-medium transition-colors",
                view === "calendario" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("calendario")}
            >
              <CalendarDays className="mr-1 inline h-3 w-3" />
              Mês
            </button>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova Obrigação
          </Button>
        </div>
      }
    >
      {/* Alert Center at the top */}
      <AlertCenter className="mb-6" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main area: timeline or calendar */}
        <div className="lg:col-span-2">
          {view === "agenda" ? <ObligationsTimeline /> : <MonthCalendarView />}
        </div>

        {/* Right sidebar: checklist */}
        <div className="space-y-6">
          <PreparationChecklist />
        </div>
      </div>
    </PageContainer>
  );
}
