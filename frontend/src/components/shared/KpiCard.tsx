import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  icon?: LucideIcon;
  accent?: boolean;
  variant?: "default" | "warning" | "danger";
  compact?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  trend,
  icon: Icon,
  accent = false,
  variant = "default",
  compact = false,
  className,
}: KpiCardProps) {
  const borderClass = {
    default: accent ? "border-primary/30 shadow-[0_0_15px_-3px_hsl(var(--tim-gold)/0.12)]" : "",
    warning: "border-tim-warning/30",
    danger: "border-tim-danger/30",
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        compact ? "px-3 py-2.5" : "p-4",
        borderClass[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p
          className={cn(
            "font-medium uppercase tracking-wider text-muted-foreground",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              variant === "warning" && "text-tim-warning",
              variant === "danger" && "text-tim-danger",
              variant === "default" && "text-muted-foreground"
            )}
          />
        )}
      </div>
      <p
        className={cn(
          "font-semibold tracking-tight",
          compact ? "mt-0.5 text-lg" : "mt-1 text-2xl",
          accent ? "text-primary" : "text-foreground",
          variant === "danger" && "text-tim-danger",
          variant === "warning" && "text-tim-warning"
        )}
      >
        {value}
      </p>
      {trend && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend.direction === "up" && (
            <TrendingUp className="h-3 w-3 text-tim-success" />
          )}
          {trend.direction === "down" && (
            <TrendingDown className="h-3 w-3 text-tim-danger" />
          )}
          {trend.direction === "neutral" && (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-[11px]",
              trend.direction === "up" && "text-tim-success",
              trend.direction === "down" && "text-tim-danger",
              trend.direction === "neutral" && "text-muted-foreground"
            )}
          >
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
