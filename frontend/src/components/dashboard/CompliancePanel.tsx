import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface Obligation {
  label: string;
  deadline: string;
  daysLeft: number;
  status: "ok" | "approaching" | "overdue" | "submitted";
}

const obligations: Obligation[] = [
  { label: "Declaração Periódica IVA — T1", deadline: "15 Abr 2024", daysLeft: 38, status: "ok" },
  { label: "Retenções na Fonte — Mar", deadline: "20 Mar 2024", daysLeft: 12, status: "approaching" },
  { label: "Segurança Social — Mar", deadline: "10 Mar 2024", daysLeft: 2, status: "approaching" },
  { label: "Pagamento por Conta IRC — 2ª", deadline: "30 Set 2024", daysLeft: 205, status: "ok" },
];

const statusIcon = {
  ok: <CheckCircle2 className="h-3.5 w-3.5 text-tim-success" />,
  approaching: <CalendarClock className="h-3.5 w-3.5 text-tim-warning" />,
  overdue: <AlertTriangle className="h-3.5 w-3.5 text-tim-danger" />,
  submitted: <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function CompliancePanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Conformidade</h3>
        <span className="text-xs text-muted-foreground">2024</span>
      </div>

      <div className="p-4">
        {/* Tax summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <TaxSummaryItem label="IVA" value="€3.840" status="Estimado" variant="warning" />
          <TaxSummaryItem label="IRC" value="€8.200" status="Previsão anual" variant="default" />
          <TaxSummaryItem label="IES" value="—" status="Jun 2025" variant="default" />
        </div>

        {/* Obligations timeline */}
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Próximas Obrigações
          </p>
          <div className="mt-2 space-y-1">
            {obligations.map((o, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-accent/50",
                  o.daysLeft <= 5 && "bg-tim-danger/5",
                  o.daysLeft > 5 && o.daysLeft <= 15 && "bg-tim-warning/5"
                )}
              >
                {statusIcon[o.status]}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {o.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {o.deadline}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    o.daysLeft <= 5 && "bg-tim-danger/15 text-tim-danger",
                    o.daysLeft > 5 && o.daysLeft <= 15 && "bg-tim-warning/15 text-tim-warning",
                    o.daysLeft > 15 && "bg-muted text-muted-foreground"
                  )}
                >
                  {o.daysLeft}d
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaxSummaryItem({
  label,
  value,
  status,
  variant = "default",
}: {
  label: string;
  value: string;
  status: string;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold",
          variant === "warning" && "text-tim-warning",
          variant === "danger" && "text-tim-danger",
          variant === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{status}</p>
    </div>
  );
}
