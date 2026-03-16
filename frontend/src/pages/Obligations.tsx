import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useObligations } from "@/hooks/use-tax";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarCheck, AlertTriangle, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import type { Obligation } from "@/lib/api";

const STATUS_CONFIG = {
  overdue: { label: "Em atraso", cls: "bg-tim-danger/10 border-tim-danger/30 text-tim-danger", badge: "destructive" as const, icon: AlertTriangle },
  urgent: { label: "Urgente", cls: "bg-tim-warning/10 border-tim-warning/30 text-tim-warning", badge: "outline" as const, icon: Clock },
  upcoming: { label: "Próximo", cls: "bg-tim-info/10 border-tim-info/30 text-tim-info", badge: "outline" as const, icon: CalendarCheck },
  future: { label: "Futuro", cls: "border-border bg-card", badge: "outline" as const, icon: CalendarCheck },
} as const;

const TYPE_COLOR: Record<string, string> = {
  IVA: "bg-tim-warning/20 text-tim-warning",
  IRC: "bg-tim-info/20 text-tim-info",
  IRS: "bg-primary/20 text-primary",
  SS: "bg-tim-success/20 text-tim-success",
  DMR: "bg-purple-500/20 text-purple-400",
  "SAF-T": "bg-pink-500/20 text-pink-400",
};

function ObligationRow({ ob }: { ob: Obligation }) {
  const cfg = STATUS_CONFIG[ob.status];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/20", cfg.cls)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/50">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{ob.description}</p>
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", TYPE_COLOR[ob.type] ?? "bg-muted text-muted-foreground")}>
            {ob.type}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Prazo: {new Date(ob.deadline).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}
          {ob.period}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Badge variant={cfg.badge} className="text-xs">{cfg.label}</Badge>
        <p className={cn("mt-1 text-xs font-semibold", ob.days_left < 0 ? "text-tim-danger" : ob.days_left <= 7 ? "text-tim-warning" : "text-muted-foreground")}>
          {ob.days_left < 0 ? `${Math.abs(ob.days_left)}d atraso` : ob.days_left === 0 ? "Hoje" : `${ob.days_left}d`}
        </p>
      </div>
    </div>
  );
}

export default function Obligations() {
  const { data: obligations = [], isLoading } = useObligations();
  const [filter, setFilter] = useState<"all" | "overdue" | "urgent" | "upcoming" | "future">("all");

  const counts = obligations.reduce((acc, ob) => {
    acc[ob.status] = (acc[ob.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = filter === "all" ? obligations : obligations.filter((ob) => ob.status === filter);

  const groups: { title: string; status: Obligation["status"]; items: Obligation[] }[] = [
    { title: "Em Atraso", status: "overdue", items: filtered.filter((o) => o.status === "overdue") },
    { title: "Urgentes (≤7 dias)", status: "urgent", items: filtered.filter((o) => o.status === "urgent") },
    { title: "Próximos (≤30 dias)", status: "upcoming", items: filtered.filter((o) => o.status === "upcoming") },
    { title: "Futuros", status: "future", items: filtered.filter((o) => o.status === "future") },
  ].filter((g) => g.items.length > 0) as { title: string; status: Obligation["status"]; items: Obligation[] }[];

  return (
    <PageContainer
      title="Obrigações Fiscais"
      subtitle="Calendário de prazos e obrigações declarativas em Portugal"
    >
      {/* Summary strip */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([("all" as const), ("overdue" as const), ("urgent" as const), ("upcoming" as const), ("future" as const)]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "Todas" : STATUS_CONFIG[s].label}
            {s !== "all" && counts[s] ? (
              <span className="ml-1.5 rounded-full bg-background/30 px-1.5">{counts[s]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">A carregar obrigações…</div>
      ) : (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
              <CheckCircle2 className="h-10 w-10 text-tim-success" />
              <p className="mt-3 text-sm font-medium">Nenhuma obrigação nesta categoria</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.status}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title} <span className="ml-1 text-foreground">({group.items.length})</span>
                </h3>
                <div className="space-y-2">
                  {group.items.map((ob) => <ObligationRow key={ob.id} ob={ob} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </PageContainer>
  );
}
