import { cn } from "@/lib/utils";
import { Sunrise, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export function MorningBriefingCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sunrise className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Resumo do Dia
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          8 Março 2024
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {/* Yesterday */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Ontem
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <Metric label="Receita" value="€5.200" variant="success" />
            <Metric label="Gastos" value="€3.355" variant="default" />
            <Metric label="Margem" value="35,5%" variant="success" />
            <Metric label="Documentos" value="4 importados" variant="default" />
          </div>
        </div>

        {/* Today */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Hoje
          </p>
          <ul className="mt-1.5 space-y-1">
            <TaskItem text="13 movimentos por classificar" variant="warning" />
            <TaskItem text="7 documentos para processar" variant="default" />
            <TaskItem text="Segurança Social — entrega em 2 dias" variant="danger" />
          </ul>
        </div>

        {/* This week */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Esta Semana
          </p>
          <ul className="mt-1.5 space-y-1">
            <TaskItem text="Prazo Segurança Social — 10 Mar" variant="danger" />
            <TaskItem text="3 anomalias por resolver" variant="warning" />
            <TaskItem text="Retenções na Fonte — 20 Mar" variant="warning" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "danger";
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xs font-semibold",
          variant === "success" && "text-tim-success",
          variant === "danger" && "text-tim-danger",
          variant === "default" && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TaskItem({
  text,
  variant = "default",
}: {
  text: string;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          variant === "danger" && "bg-tim-danger",
          variant === "warning" && "bg-tim-warning",
          variant === "default" && "bg-muted-foreground"
        )}
      />
      <span className="text-foreground">{text}</span>
    </li>
  );
}
