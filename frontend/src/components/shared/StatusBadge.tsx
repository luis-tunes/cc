import { cn } from "@/lib/utils";

export type StatusType =
  | "pendente"
  | "importado"
  | "extraído"
  | "classificado"
  | "reconciliado"
  | "revisto"
  | "arquivado"
  | "atrasado"
  | "anomalia";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-muted text-muted-foreground",
  },
  importado: {
    label: "Importado",
    className: "bg-tim-info/15 text-tim-info border border-tim-info/30",
  },
  extraído: {
    label: "Extraído",
    className: "bg-tim-info/10 text-tim-info",
  },
  classificado: {
    label: "Classificado",
    className: "bg-primary/15 text-primary border border-primary/30",
  },
  reconciliado: {
    label: "Reconciliado",
    className: "bg-tim-success/15 text-tim-success border border-tim-success/30",
  },
  revisto: {
    label: "Revisto",
    className: "bg-tim-success/20 text-tim-success",
  },
  arquivado: {
    label: "Arquivado",
    className: "bg-muted text-muted-foreground",
  },
  atrasado: {
    label: "Atrasado",
    className: "bg-tim-danger/15 text-tim-danger border border-tim-danger/30",
  },
  anomalia: {
    label: "Anomalia",
    className: "border border-tim-danger/50 text-tim-danger bg-transparent",
  },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
