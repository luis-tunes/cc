import { cn } from "@/lib/utils";
import { AlertTriangle, XCircle, CheckCircle2, TrendingUp } from "lucide-react";

type StockStatus = "rutura" | "baixo" | "normal" | "excesso";

const config: Record<StockStatus, { label: string; icon: typeof AlertTriangle; className: string }> = {
  rutura: {
    label: "Rutura",
    icon: XCircle,
    className: "bg-tim-danger/15 text-tim-danger border border-tim-danger/30",
  },
  baixo: {
    label: "Baixo",
    icon: AlertTriangle,
    className: "bg-tim-warning/15 text-tim-warning border border-tim-warning/30",
  },
  normal: {
    label: "Normal",
    icon: CheckCircle2,
    className: "bg-tim-success/15 text-tim-success border border-tim-success/30",
  },
  excesso: {
    label: "Excesso",
    icon: TrendingUp,
    className: "bg-tim-info/15 text-tim-info border border-tim-info/30",
  },
};

interface StockStatusBadgeProps {
  status: StockStatus;
  className?: string;
}

export function StockStatusBadge({ status, className }: StockStatusBadgeProps) {
  const c = config[status] ?? config.normal;
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        c.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
