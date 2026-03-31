import { cn } from "@/lib/utils";
import {
  Clock,
  Download,
  FileSearch,
  Tags,
  CheckCircle2,
  ShieldCheck,
  Archive,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type StatusType =
  | "pendente"
  | "importado"
  | "extraído"
  | "classificado"
  | "reconciliado"
  | "revisto"
  | "arquivado"
  | "atrasado"
  | "anomalia"
  | "rejeitado";

interface StatusDef {
  label: string;
  className: string;
  dotColor: string;
  icon: LucideIcon;
}

const statusConfig: Record<StatusType, StatusDef> = {
  pendente: {
    label: "Pendente",
    className: "bg-muted text-muted-foreground",
    dotColor: "bg-muted-foreground/50",
    icon: Clock,
  },
  importado: {
    label: "Importado",
    className: "bg-tim-info/15 text-tim-info border border-tim-info/30",
    dotColor: "bg-tim-info",
    icon: Download,
  },
  extraído: {
    label: "Extraído",
    className: "bg-tim-info/10 text-tim-info",
    dotColor: "bg-tim-info",
    icon: FileSearch,
  },
  classificado: {
    label: "Classificado",
    className: "bg-primary/15 text-primary border border-primary/30",
    dotColor: "bg-primary",
    icon: Tags,
  },
  reconciliado: {
    label: "Reconciliado",
    className: "bg-tim-success/15 text-tim-success border border-tim-success/30",
    dotColor: "bg-tim-success",
    icon: CheckCircle2,
  },
  revisto: {
    label: "Revisto",
    className: "bg-tim-success/20 text-tim-success",
    dotColor: "bg-tim-success",
    icon: ShieldCheck,
  },
  arquivado: {
    label: "Arquivado",
    className: "bg-muted text-muted-foreground",
    dotColor: "bg-muted-foreground/40",
    icon: Archive,
  },
  atrasado: {
    label: "Atrasado",
    className: "bg-tim-danger/15 text-tim-danger border border-tim-danger/30",
    dotColor: "bg-tim-danger",
    icon: AlertTriangle,
  },
  anomalia: {
    label: "Anomalia",
    className: "border border-tim-danger/50 text-tim-danger bg-transparent",
    dotColor: "bg-tim-danger",
    icon: AlertTriangle,
  },
  rejeitado: {
    label: "Rejeitado",
    className: "bg-tim-danger/15 text-tim-danger border border-tim-danger/30",
    dotColor: "bg-tim-danger",
    icon: XCircle,
  },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium",
        config.className,
        className
      )}
    >
      {showIcon ? (
        <Icon className="h-3 w-3 shrink-0" />
      ) : (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotColor)} />
      )}
      {config.label}
    </span>
  );
}
